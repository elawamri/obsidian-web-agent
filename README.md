# 🔮 Obsidian Web Agent

Your intelligent Obsidian assistant for the web - capture content from any website into your vault with smart tagging and templating.

## 🎯 Purpose

Obsidian Web Agent is a Chrome extension that acts as your personal web clipper and content processor for Obsidian. It automatically extracts information from various websites and creates formatted Obsidian notes using customizable templates with smart tag mapping and autocomplete features.

## ✨ Features

- **🔄 Multiple Flows** - Different extraction modes for different websites (Goodreads, generic web pages, and more coming)
- **🏷️ Smart Tag Mapping** - Fuzzy matches content categories to your existing vault tags
- **📁 Location Autocomplete** - Quick folder selection from your vault structure
- **📝 Custom Templates** - Each flow uses appropriate templates for the content type
- **🔗 Wiki-Links** - Automatically creates internal links for authors/people
- **⚙️ Configurable** - Customize vault settings, tags, folders, and mappings

## 📁 File Structure

```
obsidian-web-agent/
├── manifest.json          # Extension configuration
├── core.js               # Shared functionality module
├── flows.js              # Flow registry and definitions
├── popup.html            # Main UI
├── popup.css             # Styling
├── popup.js              # Main logic & UI rendering
├── options.html          # Settings page UI
├── options.js            # Settings logic
├── README.md             # Documentation
└── flows/
    └── goodreads/
        └── content.js    # Goodreads-specific scraper
```

## 🔧 Available Flows

### 📚 Goodreads Books
Extracts book information from Goodreads pages:
- Title, author, cover image
- Description/summary
- Genres (mapped to your tags)
- Auto-suggests location based on content

### 🌐 Generic Web Pages
Works on any website:
- Page title (with OpenGraph support)
- Meta description
- Featured image
- Source URL

### 🚀 Coming Soon
- 📄 Articles (Medium, news sites)
- 🎬 YouTube Videos
- 📝 Wikipedia
- 🐦 Twitter/X Threads
- And more based on your requests!

## 🚀 Installation

### 1. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the extension folder
5. The extension should now appear in your extensions list

### 2. Configure Settings

1. Click the extension icon in Chrome
2. Click **⚙️ Settings**
3. Configure:
   - **Vault Name** - Your vault's name (as shown in Obsidian)
   - **Default Location** - Where to save notes (e.g., "Books" or "Inbox")
   - **Vault Folders** (for autocomplete)
   - **Vault Tags** (for smart suggestions)
   - **Genre Mapping** (customize tag mappings)

## 📖 Usage

### Basic Workflow

1. **Browse any supported website** (e.g., Goodreads book page)
2. **Click the extension icon** in your browser toolbar
3. **Review extracted data** - the popup shows:
   - Content info (title, description, etc.)
   - Smart tag suggestions (from your vault)
   - Suggested save location
4. **Adjust if needed** - modify tags, location, or other fields
5. **Click "Create Note"** - opens note in Obsidian

### Smart Features

- **Auto-Tags**: Maps web categories to your vault tags
  - "Programming" → "Computer-Science, Software-Engineering"
  - "Fiction" → "Literature"
- **Auto-Location**: Suggests folder based on content type
- **Wiki-Links**: Authors become `[[Author Name]]` links

## 📝 Note Template (Books)

```markdown
---
Source: "[Here](url)"
Clickable Source: url
tags:
  - Media-Type/Book
  - Tag1
  - Tag2
Significance: 3
---
# Book Info:
#### Title: Book Title
#### Author: [[Author Name]]

### Image:
<img src="cover-url" alt="title" width="300"/>

#### Summary:
Description...

# Keywords:
# Related Notes:
# Additional Resources
# References:
```

## ⚙️ Configuration

### Vault Tags Format
Add your existing tags (without #):
```
Computer-Science
Software-Engineering
Philosophy
History
Literature
Media-Type/Book
Media-Type/Article
```

### Genre Mapping
Map web categories to your tags:
```json
{
  "Fiction": "Literature",
  "Programming": "Computer-Science, Software-Engineering",
  "History": "History",
  "Philosophy": "Philosophy"
}
```

## 🏗️ Architecture

The extension uses a modular **Flow** architecture:

- **Core Module** (`core.js`) - Shared utilities for Obsidian interaction
- **Flow Registry** (`flows.js`) - Manages all content extraction flows
- **Content Scripts** (`flows/*/content.js`) - Site-specific scrapers
- **Popup UI** (`popup.js`) - Dynamic form rendering based on active flow

Adding a new flow is as simple as:
1. Register flow configuration in `flows.js`
2. Create content script for data extraction
3. Define form fields and note template

## 🐛 Troubleshooting

- **Settings must be configured** before first use
- **Vault name is case-sensitive** - must match exactly
- **Tags need hashtags removed** (use `Computer-Science` not `#Computer-Science`)
- **Content length limit**: 8000 chars (longer content copied to clipboard)

## 📄 License

MIT License - Feel free to modify and extend!

---

**Made with 💜 for the Obsidian community**
