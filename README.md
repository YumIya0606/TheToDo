# TheToDo - Modern Productivity Suite

A beautiful, feature-rich task and note management application built with **Tauri** + **React** + **TypeScript**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## ✨ Features

### Task Management
- 📋 **Multiple Views**: Dashboard, List, Kanban Board, Eisenhower Matrix
- 🏷️ **Tags & Categories**: Organize tasks with custom tags
- ⚡ **Priority Levels**: Low, Medium, High, Urgent
- 📅 **Due Dates**: Never miss a deadline
- ✅ **Subtasks**: Break down complex tasks
- 🎯 **Smart Filtering**: Find tasks quickly

### Notes
- 📝 **Rich Notes**: Create and organize notes with titles and content
- 📁 **Folders**: Categorize notes by folders
- 🏷️ **Tagging**: Tag notes for easy retrieval
- 🔍 **Search**: Quick search across all notes

### Unified Tag System
- 🔖 **Tag Browser**: View all tasks and notes by tag in one place
- ➕ **Manual Tagging**: Add custom tags to any item
- 🎨 **Visual Tag Cloud**: Beautiful tag overview

### UI/UX
- 🌙 **Dark/Light Mode**: Toggle between themes (Dark mode default)
- 💫 **Smooth Animations**: Polished transitions and effects
- 📱 **Responsive Design**: Works on all screen sizes
- ⌨️ **Keyboard Shortcuts**: Efficient workflow

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Rust (for Tauri)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/thetodo.git
cd thetodo

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build

🛠️ Tech Stack
Frontend: React 18, TypeScript, Tailwind CSS
State Management: Zustand
Desktop Framework: Tauri v2
Icons: Lucide React
Build Tool: Vite

📁 Project Structure
thetodo/
├── src/
│   ├── components/
│   │   ├── common/       # Shared components
│   │   ├── todo/         # Task-related components
│   │   ├── notes/        # Note-related components
│   │   ├── tags/         # Tag browser
│   │   ├── settings/     # Settings page
│   │   └── analytics/    # Dashboard & stats
│   ├── stores/           # Zustand stores
│   ├── types/            # TypeScript types
│   └── lib/              # Utilities
├── src-tauri/            # Tauri backend (Rust)
└── package.json

🎯 Roadmap
1.Cloud sync
2.Mobile app (iOS/Android)
3.Collaboration features
4.Advanced analytics
5.Calendar integration
6.AI-powered suggestions

🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

1.Fork the repository
2.Create your feature branch (git checkout -b feature/amazing-feature)
3.Commit your changes (git commit -m 'Add some amazing feature')
4.Push to the branch (git push origin feature/amazing-feature)
5.Open a Pull Request

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments

Built with Tauri
Icons by Lucide
UI inspiration from modern productivity apps


Made with ❤️ for productive people everywhere.