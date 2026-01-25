// Obsidian Web Agent - Flow Registry
// Manages all available flows and their configurations

const FlowRegistry = {
  // All registered flows
  flows: {},

  // Register a new flow
  register(flowConfig) {
    this.flows[flowConfig.id] = flowConfig;
  },

  // Get flow by ID
  getFlow(id) {
    return this.flows[id];
  },

  // Get all flows
  getAllFlows() {
    return Object.values(this.flows);
  },

  // Detect which flow matches the current URL
  detectFlow(url) {
    for (const flow of Object.values(this.flows)) {
      if (flow.urlPatterns.some(pattern => url.match(pattern))) {
        return flow;
      }
    }
    return null;
  },

  // Get flows that match the current URL
  getMatchingFlows(url) {
    return Object.values(this.flows).filter(flow =>
      flow.urlPatterns.some(pattern => url.match(pattern))
    );
  }
};

// ============================================
// FLOW: Goodreads Book Import
// ============================================
FlowRegistry.register({
  id: 'goodreads',
  name: 'Goodreads Book',
  description: 'Import book information from Goodreads',
  icon: '📚',
  urlPatterns: [
    /goodreads\.com\/book\/show\//
  ],
  
  // Default media type tag for this flow
  mediaTypeTag: 'Media-Type/Book',
  
  // Default template for this flow
  defaultTemplate: 'Book Note Template',
  
  // Genre to tag mapping specific to this flow
  genreMapping: {
    'Fiction': 'Literature',
    'Science Fiction': 'Computer-Science, Science-Fiction',
    'Fantasy': 'Literature, Fantasy',
    'History': 'History',
    'Philosophy': 'Philosophy',
    'Computer Science': 'Computer-Science',
    'Programming': 'Computer-Science, Software-Engineering',
    'Biography': 'Biography',
    'Self Help': 'Psychology, Self-Improvement',
    'Business': 'Economics, Business',
    'Science': 'Science',
    'Politics': 'Politics',
    'Economics': 'Economics',
    'Sociology': 'Sociology',
    'Psychology': 'Psychology',
    'Neuroscience': 'Neuroscience',
    'Mathematics': 'Mathematics',
    'Physics': 'Physics',
    'Biology': 'Biology'
  },

  // Generate tags based on genres
  generateTags(genres, settings) {
    const suggestedTags = new Set([this.mediaTypeTag]);
    const vaultTags = settings.vaultTags || [];
    
    genres.forEach(genre => {
      const normalized = genre.trim().toLowerCase();
      
      // Check exact mapping first
      if (this.genreMapping[genre]) {
        const mappedTags = this.genreMapping[genre].split(',').map(t => t.trim());
        mappedTags.forEach(tag => suggestedTags.add(tag));
        return;
      }
      
      // Fuzzy match against vault tags
      const matchedTag = ObsidianAgent.fuzzyMatchTag(normalized, vaultTags);
      if (matchedTag) {
        suggestedTags.add(matchedTag);
      }
    });
    
    return Array.from(suggestedTags);
  },

  // Note: generateNoteContent has been removed in favor of template-based system
  // Templates are fetched from vault and use variable substitution

  // Form fields configuration for this flow
  formFields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'author', label: 'Author', type: 'text', required: true },
    { id: 'imageUrl', label: 'Image URL', type: 'url', required: true, showPreview: true },
    { id: 'description', label: 'Summary', type: 'textarea', rows: 6 },
    { id: 'tags', label: 'Tags', type: 'tags' },
    { id: 'significance', label: 'Significance (1-5)', type: 'number', min: 1, max: 5, default: 3 },
    { id: 'location', label: 'Note Location', type: 'location' },
    { id: 'template', label: 'Note Template', type: 'template' },
    { id: 'sourceUrl', label: 'Goodreads URL', type: 'url', readonly: true }
  ],

  // Map extracted data to form fields
  mapDataToForm(data) {
    return {
      title: data.title,
      author: data.author,
      imageUrl: data.imageUrl,
      description: data.description,
      sourceUrl: data.pageUrl,
      genres: data.genres || []
    };
  },

  // Default location for books
  defaultLocation: 'Books'
});

// ============================================
// FLOW: YouTube Video/Playlist Import
// ============================================
FlowRegistry.register({
  id: 'youtube',
  name: 'YouTube Video/Playlist',
  description: 'Import video or playlist information from YouTube',
  icon: '🎥',
  urlPatterns: [
    /youtube\.com\/watch/,
    /youtube\.com\/playlist/,
    /youtu\.be\//,
    /youtube\.com\/shorts\//
  ],
  
  // No default template - user can choose subject-specific templates (Biology, Physics, etc.)
  defaultTemplate: null,
  
  // Generate tags based on content type
  generateTags(data, settings) {
    const suggestedTags = new Set();
    const vaultTags = settings.vaultTags || [];
    
    // Add Resource tag for playlists if it exists in vault
    if (data.isPlaylist) {
      // Try to find Resource tag with flexible matching
      const resourceTag = vaultTags.find(tag => {
        const cleanTag = tag.toLowerCase().replace(/^#/, '');
        return cleanTag === 'resource' || cleanTag === 'resources';
      });
      
      if (resourceTag) {
        // Remove leading # if present
        const cleanTag = resourceTag.startsWith('#') ? resourceTag.substring(1) : resourceTag;
        suggestedTags.add(cleanTag);
      } else {
        // If no Resource tag in vault, add it anyway
        suggestedTags.add('Resource');
      }
    }
    
    return Array.from(suggestedTags);
  },

  // Form fields configuration for this flow
  formFields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'channel', label: 'Channel', type: 'text', required: false },
    { id: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url', required: false, showPreview: true },
    { id: 'description', label: 'Description', type: 'textarea', rows: 4 },
    { id: 'tags', label: 'Tags', type: 'tags' },
    { id: 'significance', label: 'Significance (1-5)', type: 'number', min: 1, max: 5, default: 3 },
    { id: 'location', label: 'Note Location', type: 'location' },
    { id: 'template', label: 'Note Template', type: 'template' }
  ],

  // Map extracted data to form fields
  mapDataToForm(data) {
    return {
      title: data.title,
      channel: data.channel,
      thumbnailUrl: data.thumbnailUrl,
      description: data.description,
      sourceUrl: data.pageUrl,
      contentType: data.isPlaylist ? 'Playlist' : 'Video',
      isPlaylist: data.isPlaylist  // Preserve this for tag generation
    };
  },

  // Default location for YouTube content
  defaultLocation: 'Resources'
});

// ============================================
// FLOW: Generic Web Page
// ============================================

// Generic Web Page flow (always available as fallback)
FlowRegistry.register({
  id: 'generic',
  name: 'Web Page',
  description: 'Save any web page to Obsidian',
  icon: '🌐',
  urlPatterns: [
    /.*/  // Matches any URL
  ],
  mediaTypeTag: 'Media-Type/Web-Page',
  defaultTemplate: 'Web Page Note Template',
  
  generateTags(data, settings) {
    return [this.mediaTypeTag];
  },

  formFields: [
    { id: 'title', label: 'Title', type: 'text', required: true },
    { id: 'sourceUrl', label: 'URL', type: 'url', readonly: true },
    { id: 'description', label: 'Notes', type: 'textarea', rows: 6 },
    { id: 'tags', label: 'Tags', type: 'tags' },
    { id: 'significance', label: 'Significance (1-5)', type: 'number', min: 1, max: 5, default: 3 },
    { id: 'location', label: 'Note Location', type: 'location' },
    { id: 'template', label: 'Note Template', type: 'template' }
  ],

  // Note: generateNoteContent removed - uses template system

  mapDataToForm(data) {
    return {
      title: data.title || document.title,
      sourceUrl: data.pageUrl || window.location.href,
      description: data.description || ''
    };
  },

  defaultLocation: 'Inbox'
});

// Export for use in other modules
window.FlowRegistry = FlowRegistry;
