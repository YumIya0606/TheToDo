import { useEffect, useRef } from 'react';

const VERTEX_SHADER_SRC = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_fill; // 0.0 .. 1.0

// Hash / noise for caustics
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 18.5453);
}

float voronoi(in vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float res = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.5 * sin(u_time * 0.6 + 6.2831 * o);
      float d = distance(g + o, f);
      if (d < res) res = d;
    }
  }
  return res;
}

void main() {
  // Map to 0..1 uv space, y up
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Three overlapping sine waves with different frequency/speed for the surface
  float wave1 = sin(uv.x * 12.0 + u_time * 1.6) * 0.012;
  float wave2 = sin(uv.x * 20.0 - u_time * 2.3 + 1.7) * 0.008;
  float wave3 = cos(uv.x * 7.0 + u_time * 1.1) * 0.016;
  float waveHeight = wave1 + wave2 + wave3;

  float surfaceY = u_fill + waveHeight;

  // Above the waterline: fully transparent (circle's top stays empty)
  if (uv.y > surfaceY) {
    discard;
  }

  // Depth from surface (0.0 at surface, increases downward)
  float depth = surfaceY - uv.y;

  // Base ocean gradient (deep sea → tropical crest)
  vec3 deepBlue  = vec3(0.0, 0.15, 0.4);
  vec3 midBlue   = vec3(0.0, 0.40, 0.7);
  vec3 cyanCrest = vec3(0.0, 0.75, 0.95);

  vec3 color = mix(cyanCrest, midBlue, smoothstep(0.0, 0.30, depth));
  color = mix(color, deepBlue, smoothstep(0.22, 0.85, depth));

  // Underwater light caustics (scaled voronoi shimmering)
  vec2 cavUV = uv * vec2(6.0, 10.0);
  float cav = voronoi(cavUV);
  float caustics = pow(1.0 - cav, 4.0) * 0.55 * smoothstep(0.65, 0.05, depth);
  color += caustics * vec3(0.20, 0.60, 0.75);

  // Specular highlight at the surface (soft glow following the wave crest)
  float crestDist = abs(uv.y - surfaceY);
  float spec = smoothstep(0.02, 0.0, crestDist);
  // Highlight shimmers along x with time — boosted for "liquid glass" feel
  spec *= 0.8 + 0.5 * sin(uv.x * 30.0 + u_time * 3.0);
  color += spec * vec3(0.9, 1.0, 1.0) * 0.85;

  // Slight vignette inside the circle for spherical feel
  vec2 c = uv - 0.5;
  float vig = 1.0 - dot(c, c) * 0.9;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export function FocusWaterShader({ progressPct }: { progressPct: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef(progressPct);

  // Keep the latest fill value accessible inside the render loop without re-init
  useEffect(() => {
    fillRef.current = Math.min(100, Math.max(0, progressPct)) / 100;
  }, [progressPct]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    try {
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
      }
      gl.useProgram(program);

      // Fullscreen quad
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const positionLoc = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      const uTime = gl.getUniformLocation(program, 'u_time');
      const uResolution = gl.getUniformLocation(program, 'u_resolution');
      const uFill = gl.getUniformLocation(program, 'u_fill');

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      let rafId = 0;
      const startTime = performance.now();

      const render = () => {
        const time = (performance.now() - startTime) / 1000;
        gl.uniform1f(uTime, time);
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uFill, fillRef.current);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        rafId = requestAnimationFrame(render);
      };
      rafId = requestAnimationFrame(render);

      return () => cancelAnimationFrame(rafId);
    } catch (err) {
      console.error('WebGL init failed:', err);
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={256}
      className="w-64 h-64 rounded-full border-[6px] border-slate-800 shadow-[0_0_40px_rgba(0,180,255,0.4)] bg-slate-900/40"
    />
  );
}
