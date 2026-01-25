// Obsidian Web Agent - Main Popup Logic
// Handles UI rendering, form management, and flow execution

let currentFlow = null;
let currentData = null;
let settings = {};

// Tag autocomplete state
let selectedTagsSet = new Set();
let allAvailableTags = [];
let suggestedTagsList = [];
let highlightedIndex = -1;

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    // Load settings - force fresh load from storage
    settings = await chrome.storage.sync.get({
      vaultPath: '',
      defaultLocation: 'Books',
      defaultSignificance: 3,
      vaultFolders: [],
      vaultTags: [],
      vaultTemplates: [],
      templatePattern: '.*Note Template\\.md$',
      localRestApiUrl: 'http://127.0.0.1:27123',
      localRestApiKey: '',
      genreMapping: {},
      tagMappingHistory: {}
    });
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Detect matching flows
    const matchingFlows = FlowRegistry.getMatchingFlows(tab.url);
    
    // Filter out generic flow if we have specific flows
    const specificFlows = matchingFlows.filter(f => f.id !== 'generic');
    
    if (specificFlows.length > 1) {
      // Multiple specific flows - show selection
      showFlowSelection(specificFlows);
    } else if (specificFlows.length === 1) {
      // Single specific flow - use it directly
      await activateFlow(specificFlows[0], tab);
    } else {
      // No specific flows - show generic or prompt
      const genericFlow = FlowRegistry.getFlow('generic');
      if (genericFlow) {
        await activateFlow(genericFlow, tab);
      } else {
        showError('No compatible flow found for this page.');
      }
    }
    
  } catch (error) {
    console.error('Initialization error:', error);
    showError('An error occurred: ' + error.message);
  }
}

// ============================================
// FLOW MANAGEMENT
// ============================================

function showFlowSelection(flows) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('flowIndicator').textContent = 'Multiple actions available';
  
  const container = document.getElementById('flowOptions');
  container.innerHTML = '';
  
  flows.forEach(flow => {
    const btn = document.createElement('button');
    btn.className = 'flow-option-btn';
    btn.innerHTML = `${flow.icon} ${flow.name}`;
    btn.title = flow.description;
    btn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await activateFlow(flow, tab);
    });
    container.appendChild(btn);
  });
  
  document.getElementById('flowSelection').classList.remove('hidden');
}

async function activateFlow(flow, tab) {
  currentFlow = flow;
  
  // Update UI indicator
  document.getElementById('flowIndicator').textContent = `${flow.icon} ${flow.name}`;
  document.getElementById('flowSelection').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  
  try {
    // Try to extract data using content script
    let data;
    
    if (flow.id === 'goodreads') {
      // Use the Goodreads content script
      data = await chrome.tabs.sendMessage(tab.id, { action: 'extractBookData' });
    } else if (flow.id === 'youtube') {
      // Use the YouTube content script
      data = await chrome.tabs.sendMessage(tab.id, { action: 'extractYouTubeData' });
    } else {
      // Generic extraction - get basic page info
      data = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractGenericPageData
      });
      data = data[0]?.result || { success: false };
    }
    
    if (!data || !data.success) {
      showError('Failed to extract content. Please try refreshing the page.');
      return;
    }
    
    currentData = data;
    
    // Map data to form and render
    const formData = flow.mapDataToForm ? flow.mapDataToForm(data) : data;
    renderForm(flow, formData);
    
  } catch (error) {
    console.error('Flow activation error:', error);
    showError('Failed to extract content: ' + error.message);
  }
}

// Generic page data extraction (injected into page)
function extractGenericPageData() {
  try {
    // Get page title
    const title = document.title || '';
    
    // Get meta description
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    
    // Get OpenGraph data if available
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    
    return {
      title: ogTitle || title,
      description: ogDesc || metaDesc,
      imageUrl: ogImage || '',
      pageUrl: window.location.href,
      success: true
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// FORM RENDERING
// ============================================

function renderForm(flow, data) {
  const formFields = document.getElementById('formFields');
  formFields.innerHTML = '';
  
  flow.formFields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    // Label
    const label = document.createElement('label');
    label.setAttribute('for', field.id);
    label.textContent = field.label + (field.required ? ' *' : '');
    formGroup.appendChild(label);
    
    // Field based on type
    switch (field.type) {
      case 'text':
      case 'url':
      case 'number':
        const input = document.createElement('input');
        input.type = field.type;
        input.id = field.id;
        input.name = field.id;
        if (field.required) input.required = true;
        if (field.readonly) input.readOnly = true;
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        input.value = data[field.id] || field.default || '';
        formGroup.appendChild(input);
        
        // Image preview for URL fields
        if (field.showPreview) {
          const preview = document.createElement('img');
          preview.id = 'imagePreview';
          preview.className = 'image-preview' + (data[field.id] ? '' : ' hidden');
          preview.src = data[field.id] || '';
          preview.alt = 'Preview';
          formGroup.appendChild(preview);
          
          input.addEventListener('input', (e) => {
            if (e.target.value) {
              preview.src = e.target.value;
              preview.classList.remove('hidden');
            } else {
              preview.classList.add('hidden');
            }
          });
        }
        break;
        
      case 'textarea':
        const textarea = document.createElement('textarea');
        textarea.id = field.id;
        textarea.name = field.id;
        textarea.rows = field.rows || 4;
        if (field.required) textarea.required = true;
        textarea.value = data[field.id] || '';
        formGroup.appendChild(textarea);
        break;
        
      case 'tags':
        renderTagField(formGroup, field, data, flow);
        break;
        
      case 'location':
        renderLocationField(formGroup, field, data, flow);
        break;
        
      case 'template':
        renderTemplateField(formGroup, field, data, flow);
        break;
    }
    
    // Help text
    if (field.helpText) {
      const help = document.createElement('p');
      help.className = 'help-text';
      help.textContent = field.helpText;
      formGroup.appendChild(help);
    }
    
    formFields.appendChild(formGroup);
  });
  
  // Hide loading, show form
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('contentForm').classList.remove('hidden');
}

// ============================================
// TAG AUTOCOMPLETE
// ============================================

function renderTagField(container, field, data, flow) {
  // Tag input container
  const tagInputContainer = document.createElement('div');
  tagInputContainer.className = 'tag-input-container';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'tagInput';
  input.placeholder = 'Type to search tags...';
  input.autocomplete = 'off';
  tagInputContainer.appendChild(input);
  
  const autocomplete = document.createElement('div');
  autocomplete.id = 'tagAutocomplete';
  autocomplete.className = 'tag-autocomplete hidden';
  tagInputContainer.appendChild(autocomplete);
  
  container.appendChild(tagInputContainer);
  
  // Help text
  const helpText = document.createElement('p');
  helpText.className = 'help-text';
  helpText.textContent = 'Type to search and select tags. Press Enter to add.';
  container.appendChild(helpText);
  
  // Selected tags display
  const selectedTagsDiv = document.createElement('div');
  selectedTagsDiv.id = 'selectedTags';
  selectedTagsDiv.className = 'selected-tags';
  container.appendChild(selectedTagsDiv);
  
  // Hidden input for form submission
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.id = 'tags';
  hiddenInput.name = 'tags';
  container.appendChild(hiddenInput);
  
  // Generate suggested tags - use currentData which has the original extracted data
  let suggestedTags = [];
  const genres = data.genres || currentData?.genres || [];
  
  if (flow.generateTags) {
    // For YouTube flow, pass the data to check if it's a playlist
    suggestedTags = flow.generateTags(currentData || data, settings);
  } else if (genres.length > 0 && flow.generateTags) {
    suggestedTags = flow.generateTags(genres, settings);
  } else if (flow.mediaTypeTag) {
    suggestedTags = [flow.mediaTypeTag];
  }
  
  console.log('Genres found:', genres);
  console.log('Suggested tags:', suggestedTags);
  console.log('Vault tags:', settings.vaultTags);
  
  // Initialize autocomplete after DOM is ready
  setTimeout(() => {
    initializeTagAutocomplete(suggestedTags, settings.vaultTags || []);
  }, 0);
}

function initializeTagAutocomplete(suggestedTags, vaultTags) {
  // Reset state
  allAvailableTags = [...new Set([...vaultTags, ...suggestedTags])];
  suggestedTagsList = suggestedTags;
  selectedTagsSet = new Set(suggestedTags); // Auto-select suggested tags
  highlightedIndex = -1;
  
  const input = document.getElementById('tagInput');
  const autocomplete = document.getElementById('tagAutocomplete');
  
  if (!input || !autocomplete) {
    console.error('Tag input or autocomplete element not found');
    return;
  }
  
  // Update display immediately
  updateSelectedTagsDisplay();
  updateTagsInput();
  
  // Remove any existing listeners by cloning the input
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  
  // Input event - show suggestions as user types
  newInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length === 0) {
      autocomplete.classList.add('hidden');
      return;
    }
    
    const matches = allAvailableTags.filter(tag => 
      tag.toLowerCase().includes(query) && !selectedTagsSet.has(tag)
    );
    
    if (matches.length === 0) {
      autocomplete.classList.add('hidden');
      return;
    }
    
    autocomplete.innerHTML = '';
    autocomplete.classList.remove('hidden');
    highlightedIndex = -1;
    
    matches.forEach((tag, index) => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete-item';
      if (suggestedTagsList.includes(tag)) {
        item.classList.add('suggested');
      }
      item.textContent = tag;
      item.dataset.index = index;
      
      item.addEventListener('click', () => {
        addTag(tag);
        newInput.value = '';
        autocomplete.classList.add('hidden');
        newInput.focus();
      });
      
      autocomplete.appendChild(item);
    });
  });
  
  // Keyboard navigation
  newInput.addEventListener('keydown', (e) => {
    const items = autocomplete.querySelectorAll('.tag-autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        const tag = items[highlightedIndex].textContent.replace(' ✨', '');
        addTag(tag);
        newInput.value = '';
        autocomplete.classList.add('hidden');
        highlightedIndex = -1;
      }
    } else if (e.key === 'Escape') {
      autocomplete.classList.add('hidden');
      highlightedIndex = -1;
    }
  });
  
  // Focus event - show all available tags when focused and empty
  newInput.addEventListener('focus', (e) => {
    if (e.target.value.trim() === '') {
      // Show all available tags when focused
      const availableTags = allAvailableTags.filter(tag => !selectedTagsSet.has(tag));
      if (availableTags.length > 0) {
        autocomplete.innerHTML = '';
        availableTags.forEach((tag, index) => {
          const item = document.createElement('div');
          item.className = 'tag-autocomplete-item';
          if (suggestedTagsList.includes(tag)) {
            item.classList.add('suggested');
          }
          item.textContent = tag;
          item.dataset.index = index;
          
          item.addEventListener('click', () => {
            addTag(tag);
            newInput.value = '';
            autocomplete.classList.add('hidden');
            newInput.focus();
          });
          
          autocomplete.appendChild(item);
        });
        autocomplete.classList.remove('hidden');
      }
    }
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    const tagInput = document.getElementById('tagInput');
    if (tagInput && !tagInput.contains(e.target) && !autocomplete.contains(e.target)) {
      autocomplete.classList.add('hidden');
    }
  });
}

function updateHighlight(items) {
  items.forEach((item, index) => {
    if (index === highlightedIndex) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

function addTag(tag) {
  selectedTagsSet.add(tag);
  updateSelectedTagsDisplay();
  updateTagsInput();
}

function removeTag(tag) {
  selectedTagsSet.delete(tag);
  updateSelectedTagsDisplay();
  updateTagsInput();
}

function updateSelectedTagsDisplay() {
  const container = document.getElementById('selectedTags');
  if (!container) return;
  
  container.innerHTML = '';
  
  selectedTagsSet.forEach(tag => {
    const tagEl = document.createElement('div');
    tagEl.className = 'selected-tag';
    tagEl.innerHTML = `${tag} <span class="remove">×</span>`;
    tagEl.addEventListener('click', () => removeTag(tag));
    container.appendChild(tagEl);
  });
}

function updateTagsInput() {
  const input = document.getElementById('tags');
  if (input) {
    input.value = Array.from(selectedTagsSet).join(', ');
  }
}

// ============================================
// LOCATION AUTOCOMPLETE
// ============================================

function renderLocationField(container, field, data, flow) {
  const locationContainer = document.createElement('div');
  locationContainer.className = 'tag-input-container';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'location';
  input.name = 'location';
  input.placeholder = 'Type folder path...';
  input.autocomplete = 'off';
  
  // Set default location
  const suggestedLocation = flow.defaultLocation || settings.defaultLocation || '';
  input.value = suggestedLocation;
  
  locationContainer.appendChild(input);
  
  const autocomplete = document.createElement('div');
  autocomplete.id = 'locationAutocomplete';
  autocomplete.className = 'tag-autocomplete hidden';
  locationContainer.appendChild(autocomplete);
  
  container.appendChild(locationContainer);
  
  // Help text
  const helpText = document.createElement('p');
  helpText.className = 'help-text';
  helpText.textContent = 'Example: Books/Fiction or Notes/Projects';
  container.appendChild(helpText);
  
  // Initialize autocomplete after DOM is ready
  setTimeout(() => {
    initializeLocationAutocomplete(suggestedLocation, settings.vaultFolders || []);
  }, 0);
}

function initializeLocationAutocomplete(suggestedLocation, vaultFolders) {
  const input = document.getElementById('location');
  const autocomplete = document.getElementById('locationAutocomplete');
  let locationHighlightedIndex = -1;
  
  if (!input || !autocomplete) {
    console.error('Location input or autocomplete element not found');
    return;
  }
  
  const allFolders = [...new Set([suggestedLocation, ...vaultFolders])].filter(Boolean);
  
  // Remove any existing listeners by cloning the input
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  
  newInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length === 0) {
      autocomplete.classList.add('hidden');
      return;
    }
    
    const matches = allFolders.filter(folder => 
      folder.toLowerCase().includes(query)
    );
    
    if (matches.length === 0) {
      autocomplete.classList.add('hidden');
      return;
    }
    
    autocomplete.innerHTML = '';
    autocomplete.classList.remove('hidden');
    locationHighlightedIndex = -1;
    
    matches.forEach((folder, index) => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete-item';
      if (folder === suggestedLocation) {
        item.classList.add('suggested');
      }
      item.textContent = folder;
      item.dataset.index = index;
      
      item.addEventListener('click', () => {
        newInput.value = folder;
        autocomplete.classList.add('hidden');
      });
      
      autocomplete.appendChild(item);
    });
  });
  
  // Focus event - show all folders when focused
  newInput.addEventListener('focus', (e) => {
    if (allFolders.length > 0) {
      autocomplete.innerHTML = '';
      allFolders.forEach((folder, index) => {
        const item = document.createElement('div');
        item.className = 'tag-autocomplete-item';
        if (folder === suggestedLocation) {
          item.classList.add('suggested');
        }
        item.textContent = folder;
        item.dataset.index = index;
        
        item.addEventListener('click', () => {
          newInput.value = folder;
          autocomplete.classList.add('hidden');
        });
        
        autocomplete.appendChild(item);
      });
      autocomplete.classList.remove('hidden');
    }
  });
  
  // Keyboard navigation
  newInput.addEventListener('keydown', (e) => {
    const items = autocomplete.querySelectorAll('.tag-autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      locationHighlightedIndex = Math.min(locationHighlightedIndex + 1, items.length - 1);
      updateLocationHighlight(items, locationHighlightedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      locationHighlightedIndex = Math.max(locationHighlightedIndex - 1, -1);
      updateLocationHighlight(items, locationHighlightedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (locationHighlightedIndex >= 0 && items[locationHighlightedIndex]) {
        newInput.value = items[locationHighlightedIndex].textContent.replace(' ✨', '');
        autocomplete.classList.add('hidden');
        locationHighlightedIndex = -1;
      }
    } else if (e.key === 'Escape') {
      autocomplete.classList.add('hidden');
      locationHighlightedIndex = -1;
    }
  });
  
  document.addEventListener('click', (e) => {
    const locInput = document.getElementById('location');
    if (locInput && !locInput.contains(e.target) && !autocomplete.contains(e.target)) {
      autocomplete.classList.add('hidden');
    }
  });
}

function updateLocationHighlight(items, highlightIndex) {
  items.forEach((item, index) => {
    if (index === highlightIndex) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

// ============================================
// TEMPLATE SELECTOR
// ============================================

function renderTemplateField(container, field, data, flow) {
  // Get available templates from settings
  const templates = settings.vaultTemplates || [];
  
  // Find the default template for this flow
  let defaultTemplate = null;
  if (flow.defaultTemplate) {
    defaultTemplate = templates.find(t => t.name === flow.defaultTemplate);
  }
  
  // Create container for custom dropdown
  const templateContainer = document.createElement('div');
  templateContainer.className = 'tag-input-container';
  
  // Create the input field (shows selected template)
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'templateDisplay';
  input.placeholder = templates.length > 0 ? 'Click to select template...' : 'No templates synced';
  input.autocomplete = 'off';
  input.readOnly = true;
  input.style.cursor = 'pointer';
  
  // Set default value if available
  if (defaultTemplate) {
    input.value = defaultTemplate.name;
    input.dataset.templatePath = defaultTemplate.path;
  }
  
  templateContainer.appendChild(input);
  
  // Create hidden input to store the actual template path
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.id = 'template';
  hiddenInput.name = 'template';
  hiddenInput.value = defaultTemplate ? defaultTemplate.path : '';
  container.appendChild(hiddenInput);
  
  // Create dropdown list
  const dropdown = document.createElement('div');
  dropdown.id = 'templateDropdown';
  dropdown.className = 'tag-autocomplete hidden';
  templateContainer.appendChild(dropdown);
  
  container.appendChild(templateContainer);
  
  // Help text
  const helpText = document.createElement('p');
  helpText.className = 'help-text';
  if (templates.length === 0) {
    helpText.innerHTML = 'No templates found. Go to <a href="options.html" target="_blank">Settings</a> and click "Sync from Obsidian".';
  } else {
    helpText.textContent = `Using template variables: {{title}}, {{author}}, {{tagsYaml}}, {{authorLink}}, etc.`;
  }
  container.appendChild(helpText);
  
  // Initialize dropdown after DOM is ready
  setTimeout(() => {
    initializeTemplateDropdown(templates, defaultTemplate);
  }, 0);
}

function initializeTemplateDropdown(templates, defaultTemplate) {
  const input = document.getElementById('templateDisplay');
  const hiddenInput = document.getElementById('template');
  const dropdown = document.getElementById('templateDropdown');
  
  if (!input || !dropdown || !hiddenInput) {
    console.error('Template dropdown elements not found');
    return;
  }
  
  let highlightedIndex = -1;
  
  // Show dropdown on click
  input.addEventListener('click', () => {
    if (templates.length === 0) return;
    
    // Clear and populate dropdown
    dropdown.innerHTML = '';
    highlightedIndex = -1;
    
    templates.forEach((template, index) => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete-item';
      item.textContent = template.name;
      item.dataset.index = index;
      
      // Highlight if it's the selected template
      if (input.value === template.name) {
        item.classList.add('suggested');
      }
      
      item.addEventListener('click', () => {
        input.value = template.name;
        hiddenInput.value = template.path;
        dropdown.classList.add('hidden');
        highlightedIndex = -1;
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.classList.remove('hidden');
  });
  
  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.tag-autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      updateTemplateHighlight(items, highlightedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
      updateTemplateHighlight(items, highlightedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        const templateIndex = parseInt(items[highlightedIndex].dataset.index);
        const template = templates[templateIndex];
        input.value = template.name;
        hiddenInput.value = template.path;
        dropdown.classList.add('hidden');
        highlightedIndex = -1;
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      highlightedIndex = -1;
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function updateTemplateHighlight(items, highlightIndex) {
  items.forEach((item, index) => {
    if (index === highlightIndex) {
      item.classList.add('highlighted');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('highlighted');
    }
  });
}

// ============================================
// FORM SUBMISSION
// ============================================

async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!currentFlow || !currentData) {
    showError('No flow or data available');
    return;
  }
  
  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating...</span>';
    
    // Collect form data
    const formData = {};
    currentFlow.formFields.forEach(field => {
      const el = document.getElementById(field.id);
      if (el) {
        formData[field.id] = el.value;
      }
    });
    
    // Preserve sourceUrl (YouTube/page URL) even though it's not in the form
    if (currentData.pageUrl && !formData.sourceUrl) {
      formData.sourceUrl = currentData.pageUrl;
    }
    
    // Update currentData with form values
    Object.assign(currentData, formData);
    
    // Generate note content using template system
    let content;
    
    // Check if template is selected
    if (formData.template) {
      // Fetch template content
      VaultIntegration.apiUrl = settings.localRestApiUrl;
      VaultIntegration.apiKey = settings.localRestApiKey;
      
      try {
        const templateContent = await VaultIntegration.fetchTemplateContent(formData.template);
        content = ObsidianAgent.applyTemplate(templateContent, currentData, formData);
      } catch (error) {
        throw new Error(`Failed to fetch template: ${error.message}. Make sure Local REST API is configured in settings.`);
      }
    } else {
      // Fallback: use flow's generateNoteContent if available (backward compatibility)
      if (typeof currentFlow.generateNoteContent === 'function') {
        content = await currentFlow.generateNoteContent(currentData, formData);
      } else {
        throw new Error('No template selected and no default content generator available.');
      }
    }
    
    // Create file name
    const title = formData.title || currentData.title || 'Untitled';
    const fileName = ObsidianAgent.sanitizeFileName(title) + '.md';
    const location = formData.location || currentFlow.defaultLocation || settings.defaultLocation;
    
    // Update ObsidianAgent settings before creating note
    ObsidianAgent.settings = settings;
    
    // Create note in Obsidian
    const result = await ObsidianAgent.createObsidianNote(fileName, location, content);
    
    showSuccess(result.fileName);
    
  } catch (error) {
    console.error('Form submission error:', error);
    showError('Failed to create note: ' + error.message);
  }
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

function showError(message) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('contentForm').classList.add('hidden');
  document.getElementById('flowSelection').classList.add('hidden');
  
  const errorDiv = document.getElementById('error');
  errorDiv.classList.remove('hidden');
  errorDiv.querySelector('.error-message').textContent = message;
}

function showSuccess(fileName) {
  document.getElementById('contentForm').classList.add('hidden');
  
  const successDiv = document.getElementById('success');
  successDiv.classList.remove('hidden');
  successDiv.querySelector('.success-message').textContent = `Note "${fileName}" has been created in your Obsidian vault!`;
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
  
  // Form submission
  document.getElementById('contentForm').addEventListener('submit', handleFormSubmit);
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Open note button
  document.getElementById('openNote').addEventListener('click', () => {
    if (!currentData || !currentFlow) return;
    
    const location = document.getElementById('location')?.value || currentFlow.defaultLocation;
    const title = document.getElementById('title')?.value || currentData.title;
    const fileName = ObsidianAgent.sanitizeFileName(title);
    
    ObsidianAgent.openObsidianNote(location, fileName);
  });
  
  // Retry button
  document.getElementById('retryBtn').addEventListener('click', () => {
    location.reload();
  });
});
