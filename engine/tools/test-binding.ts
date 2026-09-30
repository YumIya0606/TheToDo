import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Database } from "../server/src/db/driver.ts";

/**
 * Regression test for "Provided value cannot be bound to SQLite parameter N".
 *
 * Every column in the messages insert except the required ones is optional, and
 * an absent value arrives as `undefined`. node:sqlite rejects that, and it used
 * to be passed straight through on the named-parameter path, which broke every
 * channel at once. This walks every optional field and binds it.
 */

const tmp = path.join(os.tmpdir(), `classradar-bind-${Date.now()}.db`);
for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(tmp + suffix, { force: true });
}

const db = new Database(tmp);
db.exec(`
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    msg_id INTEGER NOT NULL,
    date INTEGER NOT NULL,
    edit_date INTEGER,
    text TEXT NOT NULL DEFAULT '',
    raw_text TEXT NOT NULL DEFAULT '',
    has_media INTEGER NOT NULL DEFAULT 0,
    media_kind TEXT,
    media_name TEXT,
    media_mime TEXT,
    media_size INTEGER,
    media_ref TEXT,
    is_forwarded INTEGER NOT NULL DEFAULT 0,
    forward_from TEXT,
    views INTEGER,
    has_reply INTEGER NOT NULL DEFAULT 0,
    reply_to_id INTEGER,
    grouped_id INTEGER,
    source TEXT NOT NULL DEFAULT 'mtproto',
    created_at INTEGER NOT NULL
  );
`);

const INSERT = `
  INSERT INTO messages
    (channel_id, msg_id, date, edit_date, text, raw_text, has_media, media_kind, media_name,
     media_mime, media_size, media_ref, is_forwarded, forward_from, views, has_reply,
     reply_to_id, grouped_id, source, created_at)
  VALUES
    (@channel_id, @msg_id, @date, @edit_date, @text, @text, @has_media, @media_kind, @media_name,
     @media_mime, @media_size, @media_ref, @is_forwarded, @forward_from, @views, @has_reply,
     @reply_to_id, @grouped_id, @source, @created_at)
`;

let pass = 0;
let fail = 0;
function check(label: string, fn: () => unknown) {
  try {
    fn();
    pass++;
    console.log(`PASS  ${label}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${label}\n        ${(e as Error).message}`);
  }
}

// 1. Every optional field explicitly undefined: the exact shape produced by the
//    MTProto and web-preview paths when a message has no media.
check("all optional media fields undefined", () => {
  db.prepare(INSERT).run({
    channel_id: 1,
    msg_id: 1,
    date: 1700000000,
    edit_date: undefined,
    text: "hello",
    has_media: 0,
    media_kind: undefined,
    media_name: undefined,
    media_mime: undefined,
    media_size: undefined,
    media_ref: undefined,
    is_forwarded: 0,
    forward_from: undefined,
    views: undefined,
    has_reply: 0,
    reply_to_id: undefined,
    grouped_id: undefined,
    source: "mtproto",
    created_at: Date.now(),
  });
});

// 2. Every optional field present.
check("all optional fields populated", () => {
  db.prepare(INSERT).run({
    channel_id: 1,
    msg_id: 2,
    date: 1700000001,
    edit_date: 1700000002,
    text: "පාඩම",
    has_media: 1,
    media_kind: "document",
    media_name: "paper.pdf",
    media_mime: "application/pdf",
    media_size: 12345,
    media_ref: "abc",
    is_forwarded: 1,
    forward_from: "Some Channel",
    views: 42,
    has_reply: 1,
    reply_to_id: 99,
    grouped_id: 7,
    source: "webpreview",
    created_at: Date.now(),
  });
});

// 3. Mixed: some set, some undefined.
check("mixed defined and undefined", () => {
  db.prepare(INSERT).run({
    channel_id: 1,
    msg_id: 3,
    date: 1700000003,
    edit_date: undefined,
    text: "x",
    has_media: 0,
    media_kind: undefined,
    media_name: "photo.jpg",
    media_mime: undefined,
    media_size: undefined,
    media_ref: undefined,
    is_forwarded: 0,
    forward_from: undefined,
    views: 5,
    has_reply: 0,
    reply_to_id: undefined,
    grouped_id: undefined,
    source: "mtproto",
    created_at: Date.now(),
  });
});

// 4. Awkward but legal values that must not throw.
check("booleans, NaN, Date, bigint and zero", () => {
  db.prepare(INSERT).run({
    channel_id: 1,
    msg_id: 4,
    date: 1700000004,
    edit_date: null,
    text: "",
    has_media: false,
    media_kind: null,
    media_name: "",
    media_mime: null,
    media_size: 0,
    media_ref: null,
    is_forwarded: true,
    forward_from: null,
    views: Number.NaN,
    has_reply: false,
    reply_to_id: null,
    grouped_id: 0n,
    source: "mtproto",
    created_at: new Date(),
  });
});

// 5. Positional binding still works.
check("positional array binding", () => {
  db.prepare(
    "INSERT INTO messages (channel_id, msg_id, date, text, source, created_at) VALUES (?,?,?,?,?,?)",
  ).run([1, 5, 1700000005, "pos", "webpreview", Date.now()]);
});

const rows = db.prepare("SELECT COUNT(*) n FROM messages").get() as any;
const last = db
  .prepare("SELECT media_mime, media_size, views, created_at FROM messages WHERE msg_id = 4")
  .get() as any;

console.log(`\nrows=${rows.n}`);
console.log(`null coercions: media_mime=${last.media_mime} media_size=${last.media_size} views=${last.views}`);
console.log(`Date stored as epoch: ${typeof last.created_at === "number" || typeof last.created_at === "bigint"}`);

db.close();
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });

console.log(`\n${pass}/${pass + fail} binding checks passed`);
process.exit(fail > 0 ? 1 : 0);
