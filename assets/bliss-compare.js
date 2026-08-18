if (typeof window.CompareManager === 'undefined') {
    window.CompareManager = class CompareManager {
        constructor() {
            this.storageKey = 'compareProducts';
            this.maxProducts = 40;
            this.selectedProducts = this.loadFromStorage();
            this.init();
        }

        init() {
            this.updateCheckboxes();
            this.renderCompareBar();
            this.updateHeaderBubble();
            this.updateIconButtons();

            // Delegate change event for toggles
            document.addEventListener('change', (e) => {
                const target = e.target;
                if (target instanceof HTMLElement && target.classList.contains('compare-toggle-input')) {
                    this.handleToggle(target);
                }
            });

            // Delegate click for compare icon buttons
            document.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;
                const iconBtn = target.closest('.compare-icon-button');
                if (iconBtn instanceof HTMLElement) {
                    this.handleIconButtonClick(iconBtn);
                }
            });

            // Handle removals via delegation
            document.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;
                const removeBtn = target.closest('.compare-bar__remove, .compareTable-removeProduct');
                if (removeBtn instanceof HTMLElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = removeBtn.dataset.id;
                    if (id) this.removeProduct(id);
                }
            });

            // Handle re-initialization on section load
            document.addEventListener('shopify:section:load', () => {
                this.updateCheckboxes();
                this.updateIconButtons();
            });

            // Handle BFcache restoration (Back button)
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    this.selectedProducts = this.loadFromStorage();
                    this.updateCheckboxes();
                    this.renderCompareBar();
                    this.updateIconButtons();
                }
            });
        }

        loadFromStorage() {
            try {
                const saved = localStorage.getItem(this.storageKey);
                // Ensure all IDs are strings
                const parsed = saved ? JSON.parse(saved) : [];
                const validProducts = parsed.map(p => ({ ...p, id: String(p.id) }));

                // Enforce limit strictly on load
                if (validProducts.length > this.maxProducts) {
                    return validProducts.slice(0, this.maxProducts);
                }

                return validProducts;
            } catch (e) {
                return [];
            }
        }

        saveToStorage() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.selectedProducts));
            this.updateCheckboxes();
            this.renderCompareBar();
            this.updateHeaderBubble();
            this.updateIconButtons();
            document.dispatchEvent(new CustomEvent('compare:updated', { detail: this.selectedProducts }));
        }

        handleToggle(checkbox) {
            if (!(checkbox instanceof HTMLInputElement)) return;
            const container = checkbox.closest('.compare-toggle');
            if (!(container instanceof HTMLElement)) return;

            const productId = String(container.dataset.productId);
            console.log('Compare: handleToggle', productId, checkbox.checked);

            if (!productId) {
                console.error('Compare: No Product ID found');
                return;
            }

            const productData = {
                id: productId,
                handle: container.dataset.productHandle,
                title: container.dataset.productTitle,
                image: container.dataset.productImage
            };

            if (checkbox.checked) {
                if (this.selectedProducts.length >= this.maxProducts) {
                    checkbox.checked = false;
                    this.showToast(`Maximum ${this.maxProducts} products for comparison.`);
                    return;
                }
                const exists = this.selectedProducts.find(p => p.id === productId);
                console.log('Compare: Exists?', exists);
                if (!exists) {
                    this.selectedProducts.push(productData);
                    this.showToast('Product added to compare');
                }
            } else {
                this.selectedProducts = this.selectedProducts.filter(p => p.id !== productId);
                this.showToast('Product removed from comparison');
            }

            console.log('Compare: Saving selection', this.selectedProducts);
            this.saveToStorage();
        }

        updateCheckboxes() {
            const checkboxes = document.querySelectorAll('.compare-toggle-input');
            checkboxes.forEach(checkbox => {
                if (!(checkbox instanceof HTMLInputElement)) return;
                const container = checkbox.closest('.compare-toggle');
                if (!(container instanceof HTMLElement)) return;
                const productId = String(container.dataset.productId);
                checkbox.checked = this.selectedProducts.some(p => p.id === productId);
            });
        }

        handleIconButtonClick(btn) {
            const productId = String(btn.dataset.compareProductId);
            if (!productId) return;

            const isSelected = this.selectedProducts.some(p => p.id === productId);

            if (isSelected) {
                this.selectedProducts = this.selectedProducts.filter(p => p.id !== productId);
                this.showToast('Product removed from comparison');
            } else {
                if (this.selectedProducts.length >= this.maxProducts) {
                    this.showToast(`Maximum ${this.maxProducts} products for comparison.`);
                    return;
                }
                this.selectedProducts.push({
                    id: productId,
                    handle: btn.dataset.productHandle,
                    title: btn.dataset.productTitle,
                    image: btn.dataset.productImage
                });
                this.showToast('Product added to compare');
            }

            this.saveToStorage();
        }

        updateIconButtons() {
            const buttons = document.querySelectorAll('.compare-icon-button');
            buttons.forEach(btn => {
                if (!(btn instanceof HTMLElement)) return;
                const productId = String(btn.dataset.compareProductId);
                const isActive = this.selectedProducts.some(p => p.id === productId);
                btn.dataset.compareActive = isActive ? 'true' : 'false';
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        removeProduct(productId) {
            this.selectedProducts = this.selectedProducts.filter(p => p.id !== String(productId));
            this.saveToStorage();

            if (window.location.pathname.includes('/pages/compare')) {
                const url = new URL(window.location.href);
                if (this.selectedProducts.length === 0) {
                    url.searchParams.delete('ids');
                } else {
                    url.searchParams.set('ids', this.selectedProducts.map(p => p.id).join(','));
                }
                window.history.replaceState({}, '', url.toString());
                document.dispatchEvent(new CustomEvent('compare:updated', { detail: this.selectedProducts }));
            }
        }

        clearAll() {
            this.selectedProducts = [];
            this.saveToStorage();
            if (window.location.pathname.includes('/pages/compare')) {
                const url = new URL(window.location.href);
                url.searchParams.delete('ids');
                window.history.replaceState({}, '', url.toString());
                document.dispatchEvent(new CustomEvent('compare:updated', { detail: [] }));
            }
        }

        getCompareUrl() {
            const ids = this.selectedProducts.map(p => p.id).join(',');
            return `/pages/compare?ids=${ids}`;
        }


        showToast(message) {
            let toast = document.querySelector('.compare-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'compare-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add('show');

            if (this._toastTimeout) clearTimeout(this._toastTimeout);
            this._toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        renderCompareBar() {
            const bars = document.querySelectorAll('compare-bar');
            bars.forEach(bar => {
                if ('update' in bar && typeof bar.update === 'function') {
                    bar.update(this.selectedProducts);
                }
            });
        }
        updateHeaderBubble() {
            const bubbles = document.querySelectorAll('.compare-bubble-count');
            const containers = document.querySelectorAll('.compare-bubble');
            const headerLinks = document.querySelectorAll('.action__compare');
            const count = this.selectedProducts.length;
            bubbles.forEach(bubble => {
                bubble.textContent = count;
            });
            containers.forEach(container => {
                if (count > 0) {
                    container.style.display = 'flex';
                } else {
                    container.style.display = 'none';
                }
            });
            headerLinks.forEach(link => {
                link.href = this.getCompareUrl();
                if (count > 0) {
                    link.style.display = '';
                } else {
                    link.style.display = 'none';
                }
            });
        }
    };
}

// Ensure single instance
if (!window.compareManager) {
    window.compareManager = new window.CompareManager();
}

if (!customElements.get('compare-bar')) {
    customElements.define('compare-bar', class extends HTMLElement {
        constructor() {
            super();
            this._minimized = false;
            this._products = [];
        }

        connectedCallback() {
            const manager = window.compareManager;
            if (manager) this.update(manager.selectedProducts);

            this.addEventListener('click', (e) => {
                if (e.target.closest('.compare-bar__clear')) {
                    window.compareManager.clearAll();
                }
                if (e.target.closest('.compare-bar__toggle-btn')) {
                    this.toggleMinimize();
                }
                if (e.target.closest('.compare-bar__minimized-trigger')) {
                    this.toggleMinimize();
                }
            });
        }

        toggleMinimize() {
            this._minimized = !this._minimized;
            this.render();
        }

        update(products) {
            if (!Array.isArray(products) || products.length === 0) {
                this.setAttribute('hidden', '');
                return;
            }

            this.removeAttribute('hidden');
            this._products = products;
            this.render();
        }

        render() {
            const products = this._products;
            if (this._minimized) {
                this.setAttribute('data-minimized', 'true');
            } else {
                this.removeAttribute('data-minimized');
            }

            const itemsHtml = products.map(p => `
        <div class="compare-bar__item">
          <div class="compare-bar__img-container">
               <img src="${p.image}" alt="${p.title}" width="50" height="50" loading="lazy">
          </div>
          <button type="button" class="compare-bar__remove" data-id="${p.id}" aria-label="Remove ${p.title}">
            <svg aria-hidden="true" focusable="false" role="presentation" class="icon icon-close" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.00023 5.58595L11.9502 0.635953C12.1455 0.440669 12.4104 0.330963 12.6866 0.330963C12.9629 0.330963 13.2277 0.440669 13.423 0.635953C13.6183 0.831238 13.728 1.09613 13.728 1.37233C13.728 1.64853 13.6183 1.91343 13.423 2.10871L8.47306 7.05872L13.423 12.0087C13.6183 12.204 13.728 12.4689 13.728 12.7451C13.728 13.0213 13.6183 13.2862 13.423 13.4815C13.2277 13.6768 12.9629 13.7865 12.6866 13.7865C12.4104 13.7865 12.1455 13.6768 11.9502 13.4815L7.00023 8.53148L2.05023 13.4815C1.85495 13.6768 1.58999 13.7865 1.31379 13.7865C1.03759 13.7865 0.772635 13.6768 0.577353 13.4815C0.382071 13.2862 0.272365 13.0213 0.272365 12.7451C0.272365 12.4689 0.382071 12.204 0.577353 12.0087L5.52739 7.05872L0.577353 2.10871C0.382071 1.91343 0.272365 1.64853 0.272365 1.37233C0.272365 1.09613 0.382071 0.831238 0.577353 0.635953C0.772635 0.440669 1.03759 0.330963 1.31379 0.330963C1.58999 0.330963 1.85495 0.440669 2.05023 0.635953L7.00023 5.58595Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      `).join('');

            this.innerHTML = `
        <div class="compare-bar__inner">
            <div class="compare-bar__header">
                <div style="display: flex; align-items: center; gap:5px;">
                    <span class="compare-bar__title">Compare Products (${products.length})</span>
                    <button class="compare-bar__toggle-btn" aria-label="Minimize Compare Bar">
                        <svg width="15" height="15" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.25 4.5L6 8.25L9.75 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <button class="compare-bar__clear link link--text">Clear All</button>
            </div>
            <div class="compare-bar__content">
                <div class="compare-bar__items">${itemsHtml}</div>
                <div class="compare-bar__actions">
                    <a href="${window.compareManager.getCompareUrl()}" class="button button--primary button--full-width">
                    Compare Now
                    </a>
                </div>
            </div>
        </div>
        <div class="compare-bar__minimized-view">
             <button class="compare-bar__minimized-trigger">
                <span>Compare (${products.length})</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(180deg);">
                    <path d="M2.25 4.5L6 8.25L9.75 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
             </button>
        </div>
      `;
        }
    });
}
