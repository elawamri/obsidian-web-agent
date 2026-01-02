// Content script to extract book information from Goodreads pages
// Flow: Goodreads Book Import

function extractBookData() {
  try {
    // Extract title
    const titleElement = document.querySelector('h1[data-testid="bookTitle"]') || 
                        document.querySelector('.BookPageTitleSection__title h1');
    const title = titleElement?.textContent?.trim() || '';

    // Extract author
    const authorElement = document.querySelector('.ContributorLink__name') ||
                         document.querySelector('span[data-testid="name"]');
    const author = authorElement?.textContent?.trim() || '';

    // Extract image URL
    const imageElement = document.querySelector('.BookPage__bookCover img') ||
                        document.querySelector('.ResponsiveImage') ||
                        document.querySelector('img[alt*="' + title + '"]');
    const imageUrl = imageElement?.src || '';

    // Extract description/summary
    const descriptionElement = document.querySelector('.DetailsLayoutRightParagraph__widthConstrained') ||
                              document.querySelector('[data-testid="description"]') ||
                              document.querySelector('#description span[style*="display:none"]');
    let description = descriptionElement?.textContent?.trim() || '';
    
    // Clean up description
    description = description.replace(/\.\.\.more$/, '').trim();

    // Extract genres/shelves
    const genreElements = document.querySelectorAll('[data-testid="genresList"] .Button__labelItem') ||
                         document.querySelectorAll('.BookPageMetadataSection__genres span');
    const genres = Array.from(genreElements)
      .slice(0, 5)
      .map(el => el.textContent.trim())
      .filter(Boolean);

    // Extract rating
    const ratingElement = document.querySelector('.RatingStatistics__rating');
    const rating = ratingElement?.textContent?.trim() || '';

    // Get current page URL
    const pageUrl = window.location.href;

    // Extract Goodreads ID from URL
    const goodreadsId = pageUrl.match(/\/show\/(\d+)/)?.[1] || '';

    return {
      title,
      author,
      imageUrl,
      description,
      genres,
      rating,
      pageUrl,
      goodreadsId,
      flowType: 'goodreads',
      success: true
    };
  } catch (error) {
    console.error('Error extracting book data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractBookData' || request.action === 'extractData') {
    const bookData = extractBookData();
    sendResponse(bookData);
  }
  return true;
});

// Store book data when page loads
window.addEventListener('load', () => {
  const bookData = extractBookData();
  if (bookData.success) {
    chrome.storage.local.set({ currentBookData: bookData });
  }
});
