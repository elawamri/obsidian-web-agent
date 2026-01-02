// Obsidian Web Agent - Core Module
// Shared functionality across all flows

const ObsidianAgent = {
  settings: {},

  // Load settings from storage
  async loadSettings() {
    const result = await chrome.storage.sync.get({
      vaultPath: '',
      defaultLocation: 'Books',
      defaultSignificance: 3,
      vaultFolders: [],
      vaultTags: [],
      genreMapping: {},
      tagMappingHistory: {}
    });
    this.settings = result;
    return result;
  },

  // Fuzzy match a term to existing vault tags
  fuzzyMatchTag(term, vaultTags) {
    const termLower = term.toLowerCase();
    
    // Keyword matching rules
    const keywordMap = {
      'programming': ['computer-science', 'software', 'coding'],
      'computer': ['computer-science', 'software'],
      'history': ['history'],
      'philosophy': ['philosophy'],
      'science': ['science', 'physics', 'biology', 'chemistry'],
      'fiction': ['literature', 'fiction'],
      'psychology': ['psychology', 'neuroscience'],
      'economics': ['economics'],
      'business': ['economics', 'business'],
      'math': ['mathematics'],
      'biology': ['biology'],
      'physics': ['physics'],
      'politics': ['politics'],
      'sociology': ['sociology']
    };
    
    // Check if any keyword matches
    for (const [keyword, possibleTags] of Object.entries(keywordMap)) {
      if (termLower.includes(keyword)) {
        for (const possibleTag of possibleTags) {
          const match = vaultTags.find(vt => 
            vt.toLowerCase().includes(possibleTag) || 
            possibleTag.includes(vt.toLowerCase())
          );
          if (match) return match;
        }
      }
    }
    
    // Direct fuzzy match
    const directMatch = vaultTags.find(vt => 
      vt.toLowerCase().includes(termLower) || 
      termLower.includes(vt.toLowerCase())
    );
    
    return directMatch || null;
  },

  // Suggest location based on tags
  suggestLocation(tags) {
    const tagLower = tags.toLowerCase();
    
    // Look for matching folders in settings
    if (this.settings.vaultFolders && this.settings.vaultFolders.length > 0) {
      for (const folder of this.settings.vaultFolders) {
        const folderLower = folder.toLowerCase();
        // Check if any tag matches folder name
        for (const tag of tagLower.split(',')) {
          if (folderLower.includes(tag.trim()) || tag.trim().includes(folderLower.split('/').pop())) {
            return folder;
          }
        }
      }
    }
    
    return this.settings.defaultLocation || 'Books';
  },

  // Format author/person as wiki-link
  formatWikiLink(name) {
    return `[[${name}]]`;
  },

  // Create note in Obsidian using URI protocol
  async createObsidianNote(fileName, location, content) {
    const fullPath = `${location}/${fileName}`;
    
    // Method 1: Try advanced URI with content (if content is not too long)
    if (content.length < 8000) {
      const encodedContent = encodeURIComponent(content);
      const encodedPath = encodeURIComponent(fullPath);
      
      const obsidianUri = `obsidian://new?vault=${encodeURIComponent(this.settings.vaultPath)}&file=${encodedPath}&content=${encodedContent}`;
      
      window.open(obsidianUri, '_blank');
    } else {
      // Method 2: For longer content, create empty file then open for editing
      const encodedPath = encodeURIComponent(fullPath);
      const obsidianUri = `obsidian://new?vault=${encodeURIComponent(this.settings.vaultPath)}&file=${encodedPath}`;
      
      window.open(obsidianUri, '_blank');
      
      // Copy content to clipboard so user can paste
      try {
        await navigator.clipboard.writeText(content);
        alert('Note created! Content copied to clipboard - paste it into the new note.');
      } catch (e) {
        console.error('Clipboard error:', e);
      }
    }
    
    return { fileName, fullPath };
  },

  // Open an existing note in Obsidian
  openObsidianNote(location, fileName) {
    const obsidianUri = `obsidian://open?vault=${encodeURIComponent(this.settings.vaultPath)}&file=${encodeURIComponent(location + '/' + fileName)}`;
    chrome.tabs.create({ url: obsidianUri });
  },

  // Sanitize file name
  sanitizeFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, '-');
  }
};

// Export for use in other modules
window.ObsidianAgent = ObsidianAgent;
