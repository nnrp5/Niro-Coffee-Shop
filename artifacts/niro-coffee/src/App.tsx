import { createContext, type FormEvent, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpLeft, Coffee, Eye, EyeOff, Instagram, Menu, Minus, Plus, Search, ShoppingBag, X, Heart, UserRound, Package, Award, Settings, LogOut, Truck, BadgeCheck, ChevronLeft, ChevronRight, Check, RefreshCw } from 'lucide-react';
import editorialImage from './assets/niro-coffee-editorial.jpg';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { getGetAccountFavoritesQueryKey, getGetAccountLoyaltyQueryKey, getGetAccountOrdersQueryKey, getGetAccountProfileQueryKey, getListProductsQueryKey, useGetAccountFavorites, useGetAccountLoyalty, useGetAccountOrders, useGetAccountProfile, useListProducts, useRemoveAccountFavorite, useSaveAccountFavorite, useUpdateAccountProfile, type StoreProduct } from '@workspace/api-client-react';
import { categoryTranslations, reviewTranslations, translations, type Language } from './i18n';
import { AuthProvider, supabase, useAuth } from './auth';

type CartLine = { product: StoreProduct; quantity: number };

const categoryLinks = ['espresso', 'single', 'blend', 'drip'].map((id, index) => ({
  id,
  number: `0${index + 1} / 04`,
  filter: id,
}));

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const localizeProduct = (product: StoreProduct, language: Language) => ({
  name: product.name[language],
  origin: product.origin[language],
  roast: product.roast[language],
  tag: product.tag[language],
});
const productImageUrl = (imageUrl: string) => {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${basePath}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};
const formatWeight = (grams: number, language: Language) =>
  language === 'ar' ? `${grams.toLocaleString('ar-KW')}غ` : `${grams.toLocaleString('en-KW')} g`;
const kwdFormatters: Record<Language, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat('ar-KW', { style: 'currency', currency: 'KWD', minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  en: new Intl.NumberFormat('en-KW', { style: 'currency', currency: 'KWD', minimumFractionDigits: 3, maximumFractionDigits: 3 }),
};
const formatKwd = (amount: number, language: Language) => kwdFormatters[language].format(amount);
const freeShippingThreshold = 20.747;
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | null>(null);
function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('Language context is unavailable.');
  return context;
}
function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'ar' ? 'en' : 'ar';
  return <button className="language-toggle" type="button" onClick={() => {
    setLanguage(nextLanguage);
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', nextLanguage);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }} aria-label={language === 'ar' ? 'Switch language to English' : 'تغيير اللغة إلى العربية'} data-testid="button-language-toggle">{language === 'ar' ? 'EN' : 'عربي'}</button>;
}

function HomeRoute() {
  const { isLoaded, user } = useAuth();
  if (!isLoaded) return <div className="account-route-loading" data-testid="state-auth-loading"><i /><i /></div>;
  return user ? <Storefront /> : <SignInPage />;
}

function Storefront() {
  const { language } = useLanguage();
  const copy = translations[language];
  const { user } = useAuth();
  const isSignedIn = Boolean(user);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const productsQuery = useListProducts({ query: { queryKey: getListProductsQueryKey(), retry: false } });
  const products = productsQuery.data ?? [];
  const favoritesQuery = useGetAccountFavorites({ query: { enabled: !!isSignedIn, queryKey: getGetAccountFavoritesQueryKey() } });
  const loyaltyQuery = useGetAccountLoyalty({ query: { enabled: !!isSignedIn, queryKey: getGetAccountLoyaltyQueryKey() } });
  const saveFavorite = useSaveAccountFavorite();
  const removeFavorite = useRemoveAccountFavorite();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [email, setEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState('');
  const [appliedPoints, setAppliedPoints] = useState(0);

  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const availablePoints = loyaltyQuery.data?.pointsBalance ?? 0;
  const pointsDiscount = Math.min(
    subtotal,
    Math.floor(
      (appliedPoints / 100) *
        (loyaltyQuery.data?.redemptionValuePer100Points ?? 0.083) *
        1000,
    ) / 1000,
  );
  const visibleProducts = useMemo(
    () => selectedCategory ? products.filter((product) => product.category === selectedCategory) : products,
    [products, selectedCategory],
  );
  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase(language === 'ar' ? 'ar' : 'en');
    if (!query) return products;
    return products.filter((product) => {
      return `${product.name.ar} ${product.origin.ar} ${product.name.en} ${product.origin.en} ${product.bagName}`.toLocaleLowerCase(language === 'ar' ? 'ar' : 'en').includes(query);
    });
  }, [products, searchTerm, language]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
        setSearchOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2200);
  };

  const addToCart = (product: StoreProduct) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }];
    });
    showToast(copy.addToCartToast(localizeProduct(product, language).name));
  };

  const changeQuantity = (id: string, amount: number) => {
    setCart((current) => current
      .map((line) => line.product.id === id ? { ...line, quantity: line.quantity + amount } : line)
      .filter((line) => line.quantity > 0));
  };

  const submitNewsletter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterMessage(copy.invalidEmail);
      return;
    }
    setNewsletterMessage(copy.newsletterSuccess);
    setEmail('');
  };

  const jumpToShop = (filter?: string) => {
    setSelectedCategory(filter ?? null);
    setMobileNavOpen(false);
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentReview = reviewTranslations[language][reviewIndex];
  const toggleFavorite = (product: StoreProduct) => {
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    const productId = String(product.id);
    const exists = (favoritesQuery.data ?? []).some((favorite) => favorite.productId === productId);
    const onSuccess = () => queryClient.invalidateQueries({ queryKey: getGetAccountFavoritesQueryKey() });
    if (exists) removeFavorite.mutate({ productId }, { onSuccess });
    else saveFavorite.mutate({ data: { productId } }, { onSuccess });
  };

  return (
    <div className={`site-shell ${language === 'en' ? 'lang-en' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="announcement">{copy.announcement} {formatKwd(freeShippingThreshold, language)}</div>
      <header className="topbar">
        <div className="nav-wrap">
          <button className="icon-button mobile-menu" aria-label={copy.openNavigation} data-testid="button-toggle-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <a className="brand" href="#home" aria-label="NOIR Coffee home" data-testid="link-home">
            <span className="brand-mark">ن</span><span className="brand-word">NOIR</span>
          </a>
          <nav className={`main-nav ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label={copy.navigation}>
            <a href="#home" data-testid="link-nav-home" onClick={() => setMobileNavOpen(false)}>{copy.home}</a>
            <a href="#shop" data-testid="link-nav-shop" onClick={() => { setSelectedCategory(null); setMobileNavOpen(false); }}>{copy.shop}</a>
            <a href="#collections" data-testid="link-nav-collections" onClick={() => setMobileNavOpen(false)}>{copy.collections}</a>
            <a href="#about" data-testid="link-nav-about" onClick={() => setMobileNavOpen(false)}>{copy.about}</a>
            <a href="#contact" data-testid="link-nav-contact" onClick={() => setMobileNavOpen(false)}>{copy.contact}</a>
          </nav>
          <div className="nav-actions">
            <LanguageToggle />
            <button className="icon-button" aria-label={copy.searchProducts} data-testid="button-open-search" onClick={() => setSearchOpen(true)}><Search size={18} strokeWidth={1.6} /></button>
            <button className="icon-button" aria-label={copy.account} data-testid="link-account" onClick={() => setLocation('/account')}><UserRound size={18} strokeWidth={1.6} /></button>
            <button className="icon-button" aria-label={copy.openCart(cartCount)} data-testid="button-open-cart" onClick={() => setCartOpen(true)}>
              <ShoppingBag size={18} strokeWidth={1.6} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="eyebrow">{copy.heroEyebrow}</div>
            <h1>{copy.heroTitle.split('|')[0]}<br />{copy.heroTitle.split('|')[1].split(' ').slice(0, -1).join(' ')} <span>{copy.heroTitle.split('|')[1].split(' ').at(-1)}</span></h1>
            <p className="hero-desc">{copy.heroDescription}</p>
            <div className="hero-buttons">
              <button className="button-primary" onClick={() => jumpToShop()}>{copy.discoverCoffee} {language === 'ar' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</button>
              <a className="button-outline" href="#about">{copy.brandStory}</a>
            </div>
            <div className="hero-note"><span className="note-stars">★★★★★</span><span>{copy.heroNote}</span></div>
          </div>
          <div className="hero-visual">
            <span className="hero-vertical">ROASTED WITH PURPOSE · KUWAIT</span>
            <div className="hero-photo"><img src={editorialImage} alt={copy.heroImage} /></div>
            <div className="hero-seal"><div><strong>{language === 'ar' ? '١٠٠٪' : '100%'}</strong>{copy.selectedBeans}</div></div>
          </div>
        </section>

        <div className="ticker" aria-label="Our coffee values">
          <div className="ticker-track" aria-hidden="true">
            {[0, 1].map((copyIndex) => <span key={copyIndex}>{copy.ticker.map((item, index) => <span key={item}>{item} <b>✳</b></span>)}</span>)}
          </div>
        </div>

        <section className="section" id="shop">
          <div className="section-heading">
              <div><div className="section-kicker">{copy.shopKicker}</div><h2>{copy.shopTitle}</h2></div>
              <div className="section-intro">{copy.shopIntro}</div>
          </div>
          <div className="products-grid">
            {productsQuery.isLoading ? <div className="products-state" role="status">{copy.productsLoading}</div>
              : productsQuery.isError ? <div className="products-state" role="alert">{copy.productsLoadError}</div>
                : visibleProducts.length === 0 ? <div className="products-state">{copy.productsEmpty}</div>
                  : visibleProducts.map((product) => {
              const localizedProduct = localizeProduct(product, language);
              return (
              <article className="product-card" key={product.id} data-testid={`card-product-${product.id}`}>
                <div className="product-visual">
                  <div className="product-photo"><img src={productImageUrl(product.imageUrl)} alt={localizedProduct.name} /></div>
                  <span className="product-tag">{localizedProduct.tag}</span>
                  <button className={`favorite-button ${(favoritesQuery.data ?? []).some((favorite) => favorite.productId === product.id) ? 'is-favorite' : ''}`} data-testid={`button-favorite-${product.id}`} aria-label={isSignedIn ? copy.saveFavoriteSignedIn : copy.saveFavoriteSignedOut} onClick={() => toggleFavorite(product)}><Heart size={16} fill={(favoritesQuery.data ?? []).some((favorite) => favorite.productId === product.id) ? 'currentColor' : 'none'} /></button>
                  <div className="bag">
                    <span className="bag-seam" />
                    <span className="bag-brand">NOIR COFFEE</span>
                    <span className="bag-origin">{product.bagName}</span>
                    <span className="bag-note">SPECIALTY · {product.weightGrams}G</span>
                    <span className="bag-stamp">ن</span>
                  </div>
                </div>
                <div className="product-meta">
                  <div><h3 className="product-title">{localizedProduct.name}</h3><p className="product-origin">{localizedProduct.origin}</p></div>
                  <span className="product-price">{formatKwd(product.price, language)}</span>
                </div>
                <div className="product-bottom">
                  <span className="roast">{localizedProduct.roast} · {formatWeight(product.weightGrams, language)}</span>
                    <button className="add-button" data-testid={`button-add-to-cart-${product.id}`} aria-label={copy.addProduct(localizedProduct.name)} onClick={() => addToCart(product)}><Plus size={16} /></button>
                </div>
              </article>
            );})}
          </div>
          {selectedCategory && <button className="text-link" style={{ marginTop: 26, background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setSelectedCategory(null)}>{copy.showAllProducts} {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button>}
        </section>

        <section className="categories" id="collections">
          <div className="categories-inner">
            <div className="section-heading">
              <div><div className="section-kicker">{copy.categoriesKicker}</div><h2>{copy.categoriesTitle}</h2></div>
              <div className="section-intro">{copy.categoriesIntro}</div>
            </div>
            <div className="category-grid">
              {categoryLinks.map((category, index) => (
                <a className="category-tile" href="#shop" data-testid={`link-category-${category.id}`} key={category.id} onClick={() => setSelectedCategory(category.filter)}>
                  <div className="category-image"><img src={editorialImage} alt="" style={{ objectPosition: `${40 + index * 12}% center` }} /></div>
                  <span className="category-number">{category.number}</span>
                  <span className="category-title">{categoryTranslations[language][category.id].title}</span>
                  <span className="category-caption">{categoryTranslations[language][category.id].description}</span>
                  <ArrowUpLeft className="category-arrow" size={18} />
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section story" id="about">
          <div className="story-art">
            <img src={editorialImage} alt={copy.storyImage} />
            <div className="story-stamp">{copy.storyStamp}</div>
          </div>
          <div className="story-copy">
            <div className="section-kicker">{copy.aboutKicker}</div>
            <h2>{copy.aboutTitle}</h2>
            <p>{copy.aboutParagraphOne}</p>
            <p>{copy.aboutParagraphTwo}</p>
            <div className="story-sign">{copy.aboutSign}</div>
            <div className="story-caption">{copy.aboutCaption}</div>
          </div>
        </section>

        <section className="section best-sellers" aria-labelledby="best-title">
          <div className="section-heading">
            <div><div className="section-kicker">{copy.bestSellersKicker}</div><h2 id="best-title">{copy.bestSellersTitle}</h2></div>
            <div className="section-intro">{copy.bestSellersIntro}</div>
          </div>
          <div className="best-seller-list">
            {products.filter((product) => product.isBestSeller).slice(0, 3).map((product, index) => {
              const localizedProduct = localizeProduct(product, language);
              return <button className="best-seller-row" data-testid={`best-seller-${product.id}`} key={product.id} onClick={() => { setSelectedCategory(product.category); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <span className="best-index">0{index + 1}</span><span className="best-name">{localizedProduct.name}</span><span className="best-origin">{localizedProduct.origin}</span><span className="best-price">{formatKwd(product.price, language)}</span>{language === 'ar' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
              </button>;
            })}
          </div>
        </section>

        <section className="why-noir" aria-labelledby="why-title">
          <div className="why-intro"><div className="section-kicker">{copy.whyKicker}</div><h2 id="why-title">{copy.whyTitle}</h2><p>{copy.whyIntro}</p></div>
          <div className="why-points">
            <article><Truck size={23} /><span className="why-number">01</span><h3>{copy.whyFastTitle}</h3><p>{copy.whyFastDescription}</p></article>
            <article><BadgeCheck size={23} /><span className="why-number">02</span><h3>{copy.whyQualityTitle}</h3><p>{copy.whyQualityDescription}</p></article>
            <article><Award size={23} /><span className="why-number">03</span><h3>{copy.whyRewardsTitle}</h3><p>{copy.whyRewardsDescription}</p></article>
          </div>
        </section>

        <section className="quote-section" aria-label={copy.reviewsLabel}>
          <div className="quote-inner">
            <div className="section-kicker">{copy.reviewsLabel}</div>
            <div className="quote-mark">“</div>
            <blockquote className="quote-text">{currentReview.quote}</blockquote>
            <div className="quote-stars" aria-label={language === 'ar' ? '٥ من ٥ نجوم' : '5 out of 5 stars'} data-testid="review-rating"><span>★★★★★</span><b>{language === 'ar' ? '٥ من ٥' : '5 out of 5'}</b></div>
            <div className="quote-author" data-testid="review-feedback">{currentReview.author} · {currentReview.detail}</div>
            <div className="quote-controls">
              <button aria-label={copy.previousReview} data-testid="button-review-previous" onClick={() => setReviewIndex((reviewIndex + reviewTranslations[language].length - 1) % reviewTranslations[language].length)}><ArrowLeft size={14} /></button>
              <button aria-label={copy.nextReview} data-testid="button-review-next" onClick={() => setReviewIndex((reviewIndex + 1) % reviewTranslations[language].length)}><ArrowRight size={14} /></button>
            </div>
          </div>
        </section>

        <section className="newsletter" id="contact">
          <div className="newsletter-inner">
            <div><div className="section-kicker">{copy.newsletterKicker}</div><h2>{copy.newsletterTitle}</h2><p>{copy.newsletterDescription}</p></div>
            <div>
              <form className="newsletter-form" onSubmit={submitNewsletter}>
                <input type="email" data-testid="input-newsletter-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} aria-label={copy.emailPlaceholder} />
                <button type="submit" data-testid="button-newsletter-submit">{copy.subscribe} {language === 'ar' ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}</button>
              </form>
              <div className="newsletter-message" role="status">{newsletterMessage}</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="brand" href="#home"><span className="brand-mark">ن</span><span className="brand-word">NOIR</span></a>
            <p>{copy.footerBrand}</p>
            <div className="socials">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={14} /></a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">t</a>
              <a href="https://www.x.com/" target="_blank" rel="noreferrer" aria-label="X">x</a>
            </div>
          </div>
            <div><h3>{copy.explore}</h3><div className="footer-links"><a href="#shop">{copy.shop}</a><a href="#collections">{copy.coffeeCollections}</a><a href="#about">{copy.brandStory}</a><a href="#contact">{copy.contact}</a></div></div>
            <div><h3>{language === 'ar' ? 'معلومات' : 'Information'}</h3><div className="footer-links"><a href="#contact">{copy.shipping}</a><a href="#contact">{copy.faq}</a><a href="#contact">{copy.returns}</a><span>{copy.storeLocation}</span></div></div>
            <div><h3>{copy.weAreHere}</h3><div className="footer-links"><span>{copy.socialSupport}</span><span>{copy.businessHours}</span><span>{copy.localRoasting}</span></div></div>
        </div>
          <div className="footer-bottom"><span>© NOIR COFFEE {new Date().getFullYear()}</span><span>{copy.footerMade}</span></div>
          <div className="footer-credit">By: Abdulaziz ali hamada</div>
      </footer>

      <div className={`overlay ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} aria-hidden="true" />
      <aside className={`drawer ${cartOpen ? 'open' : ''}`} aria-label="Shopping cart" aria-modal="true" role="dialog">
        <div className="drawer-head"><h2>{copy.cart} <span data-testid="text-cart-count">({cartCount})</span></h2><button className="close-button" aria-label={copy.closeCart} data-testid="button-close-cart" onClick={() => setCartOpen(false)}><X size={17} /></button></div>
        {cart.length === 0 ? <div className="empty-cart"><Coffee size={33} strokeWidth={1.2} /><strong>{copy.emptyCartTitle}</strong><span>{copy.emptyCartDescription}</span><button className="button-primary" style={{ marginTop: 20 }} onClick={() => { setCartOpen(false); jumpToShop(); }}>{copy.browseCoffee} {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button></div> : <>
          <div className="cart-lines">
            {cart.map(({ product, quantity }) => <div className="cart-line" key={product.id}>
              {(() => { const localizedProduct = localizeProduct(product, language); return <>
              <div className="mini-bag">NOIR<br />{product.bagName}</div>
              <div className="cart-line-copy"><strong>{localizedProduct.name}</strong><span>{formatKwd(product.price, language)} · {formatWeight(product.weightGrams, language)}</span><div className="quantity">
                <button aria-label={copy.addQuantity(localizedProduct.name)} data-testid={`button-increase-quantity-${product.id}`} onClick={() => changeQuantity(product.id, 1)}><Plus size={12} /></button><span data-testid={`text-quantity-${product.id}`}>{quantity}</span><button aria-label={copy.reduceQuantity(localizedProduct.name)} data-testid={`button-decrease-quantity-${product.id}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={12} /></button>
              </div></div>
              <strong className="product-price">{formatKwd(product.price * quantity, language)}</strong>
              </>;})()}
            </div>)}
          </div>
          <div className="cart-footer">
            {isSignedIn && <div className="cart-points" data-testid="panel-cart-points">
              <label htmlFor="cart-points-input">{copy.usePoints} <span>{availablePoints.toLocaleString(language === 'ar' ? 'ar-KW' : 'en-KW')} {copy.pointsAvailable}</span></label>
              {loyaltyQuery.isLoading ? <p>{copy.loadingPoints}</p> : loyaltyQuery.isError ? <p>{copy.pointsError}</p> : availablePoints > 0 ? <div className="cart-points-entry">
                <input id="cart-points-input" data-testid="input-cart-points" type="number" min="0" max={availablePoints} value={pointsInput} onChange={(event) => setPointsInput(event.target.value)} placeholder={copy.pointsInput} />
                <button type="button" data-testid="button-preview-points" onClick={() => {
                  const points = Math.min(availablePoints, Math.max(0, Math.floor(Number(pointsInput) || 0)));
                  setAppliedPoints(points);
                  showToast(copy.pointsPreviewToast);
                }}>{copy.preview}</button>
              </div> : <p>{copy.collectPoints}</p>}
              {appliedPoints > 0 && <div className="cart-points-discount" data-testid="value-cart-points-discount"><span>{copy.pointsDiscountPreview} ({appliedPoints})</span><strong>−{formatKwd(pointsDiscount, language)}</strong></div>}
              <small>{copy.pointsNotDeducted}</small>
            </div>}
            <div className="cart-subtotal"><span>{copy.subtotal}</span><strong>{formatKwd(subtotal, language)}</strong></div>
            {pointsDiscount > 0 && <div className="cart-subtotal cart-total-preview" data-testid="value-cart-total-preview"><span>{copy.afterPointsPreview}</span><strong>{formatKwd(subtotal - pointsDiscount, language)}</strong></div>}
            <button className="button-primary" onClick={() => showToast(copy.checkoutPreviewToast)}>{copy.continueOrder} {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button><div className="cart-note">{copy.checkoutNote}</div>
          </div>
        </>}
      </aside>

      <div className={`search-panel ${searchOpen ? 'open' : ''}`} role="dialog" aria-label={copy.searchProducts} aria-modal="true">
        <div className="search-row"><Search size={19} /><input data-testid="input-store-search" autoFocus={searchOpen} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={copy.searchPlaceholder} /><button className="close-button" aria-label={copy.closeCart} data-testid="button-close-search" onClick={() => setSearchOpen(false)}><X size={16} /></button></div>
        <div className="search-results">
          {searchResults.length ? searchResults.map((product) => <button className="search-result" key={product.id} onClick={() => { setSearchOpen(false); setSelectedCategory(product.category); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); }}>{localizeProduct(product, language).name} · {formatKwd(product.price, language)}</button>) : <span className="search-empty">{copy.searchEmpty}</span>}
        </div>
      </div>
      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">{toastMessage}</div>
    </div>
  );
}

type AccountTab = 'profile' | 'orders' | 'tracking' | 'loyalty' | 'favorites' | 'settings';

function AccountPage() {
  const { language } = useLanguage();
  const copy = translations[language];
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const profile = useGetAccountProfile({ query: { queryKey: getGetAccountProfileQueryKey() } });
  const orders = useGetAccountOrders({ query: { queryKey: getGetAccountOrdersQueryKey() } });
  const loyalty = useGetAccountLoyalty({ query: { queryKey: getGetAccountLoyaltyQueryKey() } });
  const favorites = useGetAccountFavorites({ query: { queryKey: getGetAccountFavoritesQueryKey() } });
  const productsQuery = useListProducts({ query: { queryKey: getListProductsQueryKey(), retry: false } });
  const products = productsQuery.data ?? [];
  const updateProfile = useUpdateAccountProfile();
  const removeFavorite = useRemoveAccountFavorite();
  const [tab, setTab] = useState<AccountTab>('profile');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [pointsPreview, setPointsPreview] = useState('');
  const [customerRole, setCustomerRole] = useState<'admin' | 'customer' | null>(null);
  const [customerRoleError, setCustomerRoleError] = useState(false);
  const authDisplayName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : user?.email?.split('@')[0] ?? '';
  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.fullName || authDisplayName);
      setPhone(profile.data.phone || '');
    } else if (authDisplayName) setFullName(authDisplayName);
  }, [profile.data, authDisplayName]);
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setCustomerRole(null);
      return () => { active = false; };
    }
    void supabase.from('customer_profiles')
      .select('role')
      .eq('customer_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) {
          setCustomerRoleError(Boolean(error) || !data);
          setCustomerRole(data?.role === 'admin' ? 'admin' : data ? 'customer' : null);
        }
      }, () => {
        if (active) {
          setCustomerRole(null);
          setCustomerRoleError(true);
        }
      });
    return () => { active = false; };
  }, [user?.id]);
  const pointsBalance = loyalty.data?.pointsBalance ?? 0;
  const previewPoints = Math.min(pointsBalance, Math.max(0, Number(pointsPreview) || 0));
  const previewKwd = Math.floor((previewPoints / 100) * (loyalty.data?.redemptionValuePer100Points ?? 0.083) * 1000) / 1000;
  const accountNav: { id: AccountTab; label: string; icon: typeof UserRound }[] = [
    { id: 'profile', label: copy.accountProfile, icon: UserRound },
    { id: 'orders', label: copy.accountOrders, icon: Package },
    { id: 'tracking', label: copy.accountTracking, icon: Truck },
    { id: 'loyalty', label: copy.accountLoyalty, icon: Award },
    { id: 'favorites', label: copy.accountFavorites, icon: Heart },
    { id: 'settings', label: copy.accountSettings, icon: Settings },
  ];
  const statusLabel: Record<string, string> = { order_placed: copy.orderPlaced, processing: copy.processing, shipped: copy.shipped, delivered: copy.delivered };
  const refetchAll = () => {
    if (tab === 'profile') void profile.refetch();
    if (tab === 'orders' || tab === 'tracking') void orders.refetch();
    if (tab === 'loyalty') void loyalty.refetch();
    if (tab === 'favorites') {
      void favorites.refetch();
      void productsQuery.refetch();
    }
  };
  const isLoading = (tab === 'profile' && profile.isLoading) || ((tab === 'orders' || tab === 'tracking') && orders.isLoading) || (tab === 'loyalty' && loyalty.isLoading) || (tab === 'favorites' && (favorites.isLoading || productsQuery.isLoading));
  const isError = (tab === 'profile' && profile.isError) || ((tab === 'orders' || tab === 'tracking') && orders.isError) || (tab === 'loyalty' && loyalty.isError) || (tab === 'favorites' && (favorites.isError || productsQuery.isError));
  const sectionTitle = accountNav.find((item) => item.id === tab)?.label ?? '';
  const favoriteProducts = (favorites.data ?? []).map((favorite) => ({ favorite, product: products.find((item) => item.id === favorite.productId) })).filter((item) => item.product);

  return <div className={`account-shell ${language === 'en' ? 'lang-en' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="account-topbar">
      <a className="brand" href={basePath || '/'} data-testid="link-account-home"><span className="brand-mark">ن</span><span className="brand-word">NOIR</span></a>
      <a className="account-store-link" href={`${basePath || ''}/`} data-testid="link-back-store">{copy.accountBackToStore} {language === 'ar' ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</a>
      <LanguageToggle />
    </header>
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-welcome"><span className="account-avatar">{(fullName || authDisplayName || (language === 'ar' ? 'ن' : 'N')).slice(0, 1)}</span><div><small>{copy.welcome}</small><strong data-testid="text-account-name">{fullName || authDisplayName || copy.guestName}</strong></div></div>
        <nav aria-label={copy.accountMenu}>{accountNav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} data-testid={`account-nav-${id}`} onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span>{language === 'ar' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</button>)}</nav>
        <button className="account-logout" data-testid="button-sign-out" onClick={() => void signOut().then(() => setLocation('/sign-in')).catch(() => setProfileMessage(copy.signOutError))}><LogOut size={16} /> {copy.signOut}</button>
      </aside>
      <main className="account-content">
        <div className="account-heading"><div><div className="section-kicker">{copy.yourSpace}</div><h1>{sectionTitle}</h1></div><div className="account-heading-meta">{customerRoleError && <span className="account-role" role="status">{copy.roleUnavailable}</span>}{customerRole === 'admin' && <span className="account-role" data-testid="badge-admin">{copy.adminRole}</span>}<span className="account-email" data-testid="text-account-email">{user?.email || ''}</span></div></div>
        {isLoading ? <div className="account-skeleton" aria-label={copy.loadingAccount} data-testid="state-account-loading"><i /><i /><i /></div> : isError ? <div className="account-state error" data-testid="state-account-error"><strong>{copy.accountLoadError}</strong><span>{copy.connectionRetry}</span><button className="button-outline" onClick={refetchAll}><RefreshCw size={14} /> {copy.retry}</button></div> : <>
          {tab === 'profile' && <section className="account-panel">
            <div className="panel-intro"><h2>{copy.profileIntroTitle}</h2><p>{copy.profileIntroDescription}</p></div>
            <form className="profile-form" data-testid="form-profile" onSubmit={(event) => { event.preventDefault(); updateProfile.mutate({ data: { fullName, phone } }, { onSuccess: async () => { const { error } = await supabase.from('customer_profiles').update({ customer_name: fullName.trim() }).eq('customer_id', user?.id ?? ''); if (error) { setProfileMessage(copy.profileSaveError); return; } setProfileMessage(copy.profileSaved); void queryClient.invalidateQueries({ queryKey: getGetAccountProfileQueryKey() }); }, onError: () => setProfileMessage(copy.profileSaveError) }); }}>
              <label>{copy.fullName}<input data-testid="input-profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} /></label>
              <label>{copy.email}<input value={user?.email || ''} readOnly aria-label={copy.emailFromAuth} /></label>
              <label>{copy.phone}<input data-testid="input-profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+965 5xxx xxxx" maxLength={40} dir="ltr" /></label>
              <div className="profile-actions"><span role="status" data-testid="status-profile-save">{profileMessage}</span><button className="button-primary" type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? copy.saving : copy.saveChanges} <Check size={15} /></button></div>
            </form>
          </section>}
          {tab === 'orders' && <section className="account-panel"><div className="panel-intro"><h2>{copy.orderHistoryTitle}</h2><p>{copy.orderHistoryDescription}</p></div>{!orders.data?.length ? <div className="account-empty" data-testid="state-orders-empty"><Package size={29} /><strong>{copy.noOrders}</strong><span>{copy.firstOrder}</span><a className="button-outline" href={`${basePath || ''}/#shop`}>{copy.discoverCoffee} {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</a></div> : <div className="order-list">{orders.data.map((order) => <article className="order-row" key={order.id} data-testid={`row-order-${order.id}`}><div><strong>{order.orderNumber}</strong><small>{new Date(order.placedAt).toLocaleDateString(language === 'ar' ? 'ar-KW' : 'en-KW')}</small></div><div><span className="order-status">{statusLabel[order.status] || order.status}</span><small>{order.itemsSummary.join(language === 'ar' ? '، ' : ', ')}</small></div><strong>{formatKwd(order.total, language)}</strong></article>)}</div>}</section>}
          {tab === 'tracking' && <section className="account-panel"><div className="panel-intro"><h2>{copy.orderJourney}</h2><p>{copy.trackingDescription}</p></div>{!orders.data?.length ? <div className="account-empty" data-testid="state-tracking-empty"><Truck size={29} /><strong>{copy.noShipments}</strong><span>{copy.trackingEmpty}</span></div> : <div className="tracking-list">{orders.data.map((order) => <article className="tracking-order" key={order.id} data-testid={`tracking-order-${order.id}`}><div className="tracking-order-head"><strong>{order.orderNumber}</strong><span className="order-status">{statusLabel[order.status]}</span></div><div className="tracking-steps">{[copy.orderPlaced, copy.processing, copy.shipped, copy.delivered].map((status, index) => { const sequence = ['order_placed', 'processing', 'shipped', 'delivered']; const active = sequence.indexOf(order.status) >= index; return <div className={active ? 'done' : ''} key={status}><span>{active ? <Check size={12} /> : index + 1}</span><small>{status}</small></div>; })}</div>{order.trackingNumber && <p className="tracking-number" data-testid={`tracking-number-${order.id}`}>{copy.trackingNumber} <b dir="ltr">{order.trackingNumber}</b></p>}</article>)}</div>}</section>}
          {tab === 'loyalty' && <section className="account-panel loyalty-panel"><div className="loyalty-card"><div><span>{copy.currentBalance}</span><strong data-testid="value-loyalty-points">{loyalty.data?.pointsBalance ?? '—'}</strong><small>{copy.points}</small></div><Award size={37} /></div><div className="loyalty-copy"><h2>{copy.loyaltyTitle}</h2><p>{copy.pointsCollected} {loyalty.data?.lifetimeEarned ?? '—'} {copy.pointsSoFar} {copy.usePointsPreview} {formatKwd(loyalty.data?.redemptionValuePer100Points ?? 0.083, language)}.</p></div><label className="points-preview-label">{copy.pointsPreviewLabel}<input type="number" min="0" max={pointsBalance} value={pointsPreview} onChange={(event) => setPointsPreview(event.target.value)} placeholder={copy.pointsInput} data-testid="input-points-preview" /></label><div className="points-preview" data-testid="value-points-preview"><span>{copy.previewValue}</span><strong>{formatKwd(previewKwd, language)}</strong></div><p className="preview-note">{copy.previewOnlyNote}</p></section>}
          {tab === 'favorites' && <section className="account-panel">
            <div className="panel-intro"><h2>{copy.savedCoffeesTitle}</h2><p>{copy.savedCoffeesDescription}</p></div>
            {!favoriteProducts.length ? <div className="account-empty" data-testid="state-favorites-empty"><Heart size={29} /><strong>{copy.favoritesEmptyTitle}</strong><span>{copy.favoritesEmptyDescription}</span><a className="button-outline" href={`${basePath || ''}/#shop`}>{copy.browseProducts} {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</a></div>
              : <div className="saved-grid">{favoriteProducts.map(({ favorite, product }) => {
                if (!product) return null;
                const localizedProduct = localizeProduct(product, language);
                return <article className="saved-product" key={favorite.productId} data-testid={`saved-product-${favorite.productId}`}>
                  <div className="saved-product-image"><img src={productImageUrl(product.imageUrl)} alt={localizedProduct.name} /><span>{localizedProduct.tag}</span></div>
                  <h3>{localizedProduct.name}</h3><p>{localizedProduct.origin}</p>
                  <div><strong>{formatKwd(product.price, language)}</strong><button data-testid={`button-remove-favorite-${favorite.productId}`} onClick={() => removeFavorite.mutate({ productId: favorite.productId }, { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetAccountFavoritesQueryKey() }) })}><Heart size={15} fill="currentColor" /> {copy.removeFavorite}</button></div>
                </article>;
              })}</div>}
          </section>}
          {tab === 'settings' && <section className="account-panel settings-panel"><div className="settings-mark"><Settings size={23} /></div><h2>{copy.settingsTitle}</h2><p>{copy.settingsDescription}</p><div className="settings-detail"><span>{copy.linkedEmail}</span><strong>{user?.email || '—'}</strong></div><div className="settings-detail"><span>{copy.sessionStatus}</span><strong>{copy.sessionActive}</strong></div><button className="button-outline" data-testid="button-settings-sign-out" onClick={() => void signOut().then(() => setLocation('/sign-in')).catch(() => setProfileMessage(copy.signOutError))}><LogOut size={15} /> {copy.signOut}</button></section>}
        </>}
      </main>
    </div>
  </div>;
}

function AccountRoute() {
  const { isLoaded, user } = useAuth();
  if (!isLoaded) return <div className="account-route-loading" data-testid="state-auth-loading"><i /><i /></div>;
  if (!user) return <Redirect to="/sign-in" />;
  return <AccountPage />;
}

function SignInPage() {
  const { language } = useLanguage();
  const copy = translations[language];
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMessage(copy.authInvalidCredentials);
      else setLocation('/');
    } catch {
      setMessage(copy.authGenericError);
    } finally {
      setIsSubmitting(false);
    }
  };
  if (user) return <Redirect to="/" />;
  return <div className={`auth-screen ${language === 'en' ? 'lang-en' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="auth-top"><a className="auth-brand brand" href={basePath || '/'}><span className="brand-mark">ن</span><span className="brand-word">NOIR</span></a><LanguageToggle /></div>
    <section className="auth-card">
      <span className="auth-emblem">ن</span>
      <p className="auth-tagline">{copy.signInTagline}</p>
      <h1>{copy.signInTitle}</h1>
      <p className="auth-subtitle">{copy.signInSubtitle}</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)} data-testid="form-sign-in">
        <label>{copy.email}<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} data-testid="input-sign-in-email" /></label>
        <label>{copy.password}<span className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordPlaceholder} data-testid="input-sign-in-password" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? copy.hidePassword : copy.showPassword} aria-pressed={showPassword} data-testid="button-toggle-sign-in-password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        {message && <p className="auth-message error" role="alert" data-testid="status-sign-in">{message}</p>}
        <button className="auth-submit" type="submit" disabled={isSubmitting} data-testid="button-submit-sign-in">{isSubmitting ? copy.authWorking : copy.signIn}</button>
      </form>
      <p className="auth-switch">{copy.noAccount} <a href={`${basePath || ''}/sign-up`}>{copy.signUp}</a></p>
    </section>
  </div>;
}
function SignUpPage() {
  const { language } = useLanguage();
  const copy = translations[language];
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setIsSuccess(false);
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}${basePath || ''}/` },
      });
      if (error) setMessage(copy.authSignUpFailed);
      else if (data.session) setLocation('/');
      else {
        setIsSuccess(true);
        setMessage(copy.authCheckEmail);
      }
    } catch {
      setMessage(copy.authGenericError);
    } finally {
      setIsSubmitting(false);
    }
  };
  if (user) return <Redirect to="/" />;
  return <div className={`auth-screen ${language === 'en' ? 'lang-en' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="auth-top"><a className="auth-brand brand" href={basePath || '/'}><span className="brand-mark">ن</span><span className="brand-word">NOIR</span></a><LanguageToggle /></div>
    <section className="auth-card">
      <span className="auth-emblem">ن</span>
      <p className="auth-tagline">{copy.signUpTagline}</p>
      <h1>{copy.signUpTitle}</h1>
      <p className="auth-subtitle">{copy.signUpSubtitle}</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)} data-testid="form-sign-up">
        <label>{copy.email}<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.emailPlaceholder} data-testid="input-sign-up-email" /></label>
        <label>{copy.password}<span className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordPlaceholder} data-testid="input-sign-up-password" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? copy.hidePassword : copy.showPassword} aria-pressed={showPassword} data-testid="button-toggle-sign-up-password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small className="auth-hint">{copy.passwordMinimum}</small></label>
        {message && <p className={`auth-message ${isSuccess ? 'success' : 'error'}`} role={isSuccess ? 'status' : 'alert'} data-testid="status-sign-up">{message}</p>}
        <button className="auth-submit" type="submit" disabled={isSubmitting} data-testid="button-submit-sign-up">{isSubmitting ? copy.authWorking : copy.signUp}</button>
      </form>
      <p className="auth-switch">{copy.haveAccount} <a href={`${basePath || ''}/sign-in`}>{copy.signIn}</a></p>
    </section>
  </div>;
}
function AuthCacheInvalidator() {
  const { user, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }, [isLoaded, user?.id, queryClient]);
  return null;
}
function AppRoutes() {
  return <QueryClientProvider client={queryClient}><AuthProvider><AuthCacheInvalidator /><Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/account" component={AccountRoute} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={HomeRoute} />
  </Switch></AuthProvider></QueryClientProvider>;
}
function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    if (requestedLanguage === 'ar' || requestedLanguage === 'en') return requestedLanguage;
    try { return window.localStorage.getItem('noir-language') === 'en' ? 'en' : 'ar'; }
    catch { return 'ar'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = language === 'ar'
      ? 'NOIR Coffee — قهوة مختصة من الكويت'
      : 'NOIR Coffee — Specialty Coffee in Kuwait';
    const description = language === 'ar'
      ? 'قهوة مختصة ومحاصيل موسمية مختارة بعناية، تُحمّص طازجة في الكويت من NOIR Coffee.'
      : 'Specialty coffee and carefully selected seasonal harvests, freshly roasted in Kuwait by NOIR Coffee.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    try { window.localStorage.setItem('noir-language', language); } catch { /* Keep the selection for this session even if storage is unavailable. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}><WouterRouter base={basePath}><AppRoutes /></WouterRouter></LanguageContext.Provider>;
}

export default App;
