/**
 * CMS Manager - Gestione contenuti lato client
 * Permette di modificare contenuti del sito senza codice
 */

import { ApiClient, ApiError } from './api.js';
import { showNotification } from './ui.js';

// ============================================
// STATO CMS
// ============================================

let cmsState = {
  pages: [],
  articles: [],
  gallery: [],
  videos: [],
  faq: [],
  categories: [],
  currentPage: null,
  currentArticle: null,
  currentGalleryItem: null,
  currentVideo: null,
  currentFaq: null,
  isLoading: false
};

// ============================================
// API CLIENT CMS
// ============================================

const cmsApi = {
  // Pagine
  getPages: async () => {
    const response = await ApiClient.get('/api/cms/pages');
    return response.data.pages;
  },
  
  getPage: async (key) => {
    const response = await ApiClient.get(`/api/cms/pages/${key}`);
    return response.data.page;
  },
  
  createPage: async (pageData) => {
    const response = await ApiClient.post('/api/cms/pages', pageData);
    return response.data.page;
  },
  
  updatePage: async (key, updates) => {
    const response = await ApiClient.patch(`/api/cms/pages/${key}`, updates);
    return response.data.page;
  },
  
  // Articoli
  getArticles: async (params = {}) => {
    const query = new URLSearchParams(params);
    const response = await ApiClient.get(`/api/cms/articles?${query.toString()}`);
    return response.data;
  },
  
  getArticle: async (slug) => {
    const response = await ApiClient.get(`/api/cms/articles/${slug}`);
    return response.data.article;
  },
  
  createArticle: async (articleData) => {
    const response = await ApiClient.post('/api/cms/articles', articleData);
    return response.data.article;
  },
  
  updateArticle: async (slug, updates) => {
    const response = await ApiClient.patch(`/api/cms/articles/${slug}`, updates);
    return response.data.article;
  },
  
  deleteArticle: async (slug) => {
    await ApiClient.delete(`/api/cms/articles/${slug}`);
    return true;
  },
  
  // Galleria
  getGallery: async (params = {}) => {
    const query = new URLSearchParams(params);
    const response = await ApiClient.get(`/api/cms/gallery?${query.toString()}`);
    return response.data;
  },
  
  createGalleryItem: async (formData) => {
    const response = await ApiClient.post('/api/cms/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.image;
  },
  
  updateGalleryItem: async (id, updates) => {
    const response = await ApiClient.patch(`/api/cms/gallery/${id}`, updates);
    return response.data.image;
  },
  
  deleteGalleryItem: async (id) => {
    await ApiClient.delete(`/api/cms/gallery/${id}`);
    return true;
  },
  
  // Video
  getVideos: async (params = {}) => {
    const query = new URLSearchParams(params);
    const response = await ApiClient.get(`/api/cms/videos?${query.toString()}`);
    return response.data;
  },
  
  createVideo: async (videoData) => {
    const response = await ApiClient.post('/api/cms/videos', videoData);
    return response.data.video;
  },
  
  updateVideo: async (id, updates) => {
    const response = await ApiClient.patch(`/api/cms/videos/${id}`, updates);
    return response.data.video;
  },
  
  deleteVideo: async (id) => {
    await ApiClient.delete(`/api/cms/videos/${id}`);
    return true;
  },
  
  // FAQ
  getFaq: async (params = {}) => {
    const query = new URLSearchParams(params);
    const response = await ApiClient.get(`/api/cms/faq?${query.toString()}`);
    return response.data;
  },
  
  createFaq: async (faqData) => {
    const response = await ApiClient.post('/api/cms/faq', faqData);
    return response.data.faq;
  },
  
  updateFaq: async (id, updates) => {
    const response = await ApiClient.patch(`/api/cms/faq/${id}`, updates);
    return response.data.faq;
  },
  
  deleteFaq: async (id) => {
    await ApiClient.delete(`/api/cms/faq/${id}`);
    return true;
  },
  
  // Categorie
  getCategories: async () => {
    const response = await ApiClient.get('/api/cms/categories');
    return response.data.categories;
  }
};

// ============================================
// ACTIONS CMS
// ============================================

export const CmsActions = {
  // Pagine
  loadPages: async () => {
    cmsState.isLoading = true;
    try {
      cmsState.pages = await cmsApi.getPages();
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento pagine: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  loadPage: async (key) => {
    cmsState.isLoading = true;
    try {
      cmsState.currentPage = await cmsApi.getPage(key);
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento pagina: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  savePage: async (key, updates) => {
    try {
      const page = await cmsApi.updatePage(key, updates);
      cmsState.currentPage = page;
      const index = cmsState.pages.findIndex(p => p.key === key);
      if (index !== -1) {
        cmsState.pages[index] = page;
      }
      showNotification({ type: 'success', message: 'Pagina salvata' });
      return page;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore salvataggio pagina: ${err.message}` });
      throw err;
    }
  },
  
  // Articoli
  loadArticles: async (params = {}) => {
    cmsState.isLoading = true;
    try {
      const result = await cmsApi.getArticles(params);
      cmsState.articles = result.articles;
      return result;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento articoli: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  loadArticle: async (slug) => {
    cmsState.isLoading = true;
    try {
      cmsState.currentArticle = await cmsApi.getArticle(slug);
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento articolo: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  saveArticle: async (slug, updates) => {
    try {
      const article = await cmsApi.updateArticle(slug, updates);
      cmsState.currentArticle = article;
      const index = cmsState.articles.findIndex(a => a.slug === slug);
      if (index !== -1) {
        cmsState.articles[index] = article;
      }
      showNotification({ type: 'success', message: 'Articolo salvato' });
      return article;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore salvataggio articolo: ${err.message}` });
      throw err;
    }
  },
  
  createArticle: async (articleData) => {
    try {
      const article = await cmsApi.createArticle(articleData);
      cmsState.articles.unshift(article);
      cmsState.currentArticle = article;
      showNotification({ type: 'success', message: 'Articolo creato' });
      return article;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore creazione articolo: ${err.message}` });
      throw err;
    }
  },
  
  deleteArticle: async (slug) => {
    try {
      await cmsApi.deleteArticle(slug);
      cmsState.articles = cmsState.articles.filter(a => a.slug !== slug);
      if (cmsState.currentArticle?.slug === slug) {
        cmsState.currentArticle = null;
      }
      showNotification({ type: 'success', message: 'Articolo eliminato' });
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore eliminazione articolo: ${err.message}` });
      throw err;
    }
  },
  
  // Galleria
  loadGallery: async (params = {}) => {
    cmsState.isLoading = true;
    try {
      const result = await cmsApi.getGallery(params);
      cmsState.gallery = result.images;
      return result;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento galleria: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  saveGalleryItem: async (id, updates) => {
    try {
      const image = await cmsApi.updateGalleryItem(id, updates);
      cmsState.currentGalleryItem = image;
      const index = cmsState.gallery.findIndex(i => i.id === id);
      if (index !== -1) {
        cmsState.gallery[index] = image;
      }
      showNotification({ type: 'success', message: 'Immagine salvata' });
      return image;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore salvataggio immagine: ${err.message}` });
      throw err;
    }
  },
  
  deleteGalleryItem: async (id) => {
    try {
      await cmsApi.deleteGalleryItem(id);
      cmsState.gallery = cmsState.gallery.filter(i => i.id !== id);
      if (cmsState.currentGalleryItem?.id === id) {
        cmsState.currentGalleryItem = null;
      }
      showNotification({ type: 'success', message: 'Immagine eliminata' });
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore eliminazione immagine: ${err.message}` });
      throw err;
    }
  },
  
  // Video
  loadVideos: async (params = {}) => {
    cmsState.isLoading = true;
    try {
      const result = await cmsApi.getVideos(params);
      cmsState.videos = result.videos;
      return result;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento video: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  saveVideo: async (id, updates) => {
    try {
      const video = await cmsApi.updateVideo(id, updates);
      cmsState.currentVideo = video;
      const index = cmsState.videos.findIndex(v => v.id === id);
      if (index !== -1) {
        cmsState.videos[index] = video;
      }
      showNotification({ type: 'success', message: 'Video salvato' });
      return video;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore salvataggio video: ${err.message}` });
      throw err;
    }
  },
  
  createVideo: async (videoData) => {
    try {
      const video = await cmsApi.createVideo(videoData);
      cmsState.videos.unshift(video);
      cmsState.currentVideo = video;
      showNotification({ type: 'success', message: 'Video creato' });
      return video;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore creazione video: ${err.message}` });
      throw err;
    }
  },
  
  deleteVideo: async (id) => {
    try {
      await cmsApi.deleteVideo(id);
      cmsState.videos = cmsState.videos.filter(v => v.id !== id);
      if (cmsState.currentVideo?.id === id) {
        cmsState.currentVideo = null;
      }
      showNotification({ type: 'success', message: 'Video eliminato' });
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore eliminazione video: ${err.message}` });
      throw err;
    }
  },
  
  // FAQ
  loadFaq: async (params = {}) => {
    cmsState.isLoading = true;
    try {
      const result = await cmsApi.getFaq(params);
      cmsState.faq = result.faqs;
      return result;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento FAQ: ${err.message}` });
    } finally {
      cmsState.isLoading = false;
    }
  },
  
  saveFaq: async (id, updates) => {
    try {
      const faq = await cmsApi.updateFaq(id, updates);
      cmsState.currentFaq = faq;
      const index = cmsState.faq.findIndex(f => f.id === id);
      if (index !== -1) {
        cmsState.faq[index] = faq;
      }
      showNotification({ type: 'success', message: 'FAQ salvata' });
      return faq;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore salvataggio FAQ: ${err.message}` });
      throw err;
    }
  },
  
  createFaq: async (faqData) => {
    try {
      const faq = await cmsApi.createFaq(faqData);
      cmsState.faq.unshift(faq);
      cmsState.currentFaq = faq;
      showNotification({ type: 'success', message: 'FAQ creata' });
      return faq;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore creazione FAQ: ${err.message}` });
      throw err;
    }
  },
  
  deleteFaq: async (id) => {
    try {
      await cmsApi.deleteFaq(id);
      cmsState.faq = cmsState.faq.filter(f => f.id !== id);
      if (cmsState.currentFaq?.id === id) {
        cmsState.currentFaq = null;
      }
      showNotification({ type: 'success', message: 'FAQ eliminata' });
      return true;
    } catch (err) {
      showNotification({ type: 'error', message: `Errore eliminazione FAQ: ${err.message}` });
      throw err;
    }
  },
  
  // Categorie
  loadCategories: async () => {
    try {
      cmsState.categories = await cmsApi.getCategories();
    } catch (err) {
      showNotification({ type: 'error', message: `Errore caricamento categorie: ${err.message}` });
    }
  }
};

// ============================================
// SELECTORS CMS
// ============================================

export const CmsSelectors = {
  getPages: () => cmsState.pages,
  getCurrentPage: () => cmsState.currentPage,
  getArticles: () => cmsState.articles,
  getCurrentArticle: () => cmsState.currentArticle,
  getGallery: () => cmsState.gallery,
  getCurrentGalleryItem: () => cmsState.currentGalleryItem,
  getVideos: () => cmsState.videos,
  getCurrentVideo: () => cmsState.currentVideo,
  getFaq: () => cmsState.faq,
  getCurrentFaq: () => cmsState.currentFaq,
  getCategories: () => cmsState.categories,
  isLoading: () => cmsState.isLoading
};

// ============================================
// CMS STORE
// ============================================

// Store completo per gestione stato
const CmsStore = {
  state: cmsState,
  actions: CmsActions,
  selectors: CmsSelectors
};

// ============================================
// UTILITY CMS
// ============================================

/**
 * Genera slug da titolo
 */
export function generateSlug(title) {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Sanitizza HTML per contenuti CMS
 */
export function sanitizeHtml(html) {
  // Implementazione base - per produzione usare DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, (tag) => {
      const allowedTags = ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const tagName = tag.match(/^<(\w+)/)?.[1] || '';
      if (allowedTags.includes(tagName.toLowerCase())) {
        return tag;
      }
      return '';
    });
}

/**
 * Formatta data per CMS
 */
export function formatDate(date, locale = 'it-IT') {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Ordina elementi per order_idx
 */
export function sortByOrder(items) {
  return [...items].sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0));
}

// ============================================
// EXPORT
// ============================================

export default CmsStore;

export { cmsApi, cmsState, CmsActions, CmsSelectors, CmsStore };
