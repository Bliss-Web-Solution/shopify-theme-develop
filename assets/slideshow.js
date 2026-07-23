import { Component } from '@theme/component';
import {
  center,
  closest,
  clamp,
  mediaQueryLarge,
  prefersReducedMotion,
  preventDefault,
  viewTransition,
  scheduler,
} from '@theme/utilities';
import { Scroller, scrollIntoView } from '@theme/scrolling';
import { SlideshowSelectEvent } from '@theme/events';

// The threshold for determining visibility of slides.
const SLIDE_VISIBLITY_THRESHOLD = 0.7;

/**
 * Shared viewport observer manager for lazy scroll enablement.
 *
 * Limit the number of compositor layers created by slideshows by only enabling scrolling when the slideshow is in the viewport.
 * Resolves known issues with iOS Safari where too many composition layers will crash the page.
 * When a slideshow is NOT in the viewport, it has overflow: hidden (no compositor layer).
 * When a slideshow enters the viewport, the [in-viewport] attribute is added, enabling scrolling.
 */
class SlideshowViewportObserver {
  /** @type {SlideshowViewportObserver | null} */
  static #instance = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  /**
   * Gets the singleton instance
   * @returns {SlideshowViewportObserver}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new SlideshowViewportObserver();
    }
    return this.#instance;
  }

  /**
   * Registers a slideshow to be observed for viewport visibility
   * @param {Slideshow} slideshow - The slideshow to observe
   */
  observe(slideshow) {
    if (!this.#observer) {
      this.#observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const slideshowElement = /** @type {Slideshow} */ (entry.target);
            if (entry.isIntersecting) {
              slideshowElement.setAttribute('in-viewport', '');
            } else {
              slideshowElement.removeAttribute('in-viewport');
            }
          }
        },
        {
          rootMargin: '100px',
        }
      );
    }

    this.#observer.observe(slideshow);
  }

  /**
   * Unregisters a slideshow from viewport observation
   * @param {Slideshow} slideshow - The slideshow to unobserve
   */
  unobserve(slideshow) {
    this.#observer?.unobserve(slideshow);
    slideshow.removeAttribute('in-viewport');
  }
}

/**
 * Slideshow custom element that allows sliding between content.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} scroller
 * @property {HTMLElement} slideshowContainer
 * @property {HTMLElement[]} [slides]
 * @property {HTMLElement} [current]
 * @property {HTMLElement[]} [thumbnails]
 * @property {HTMLElement[]} [dots]
 * @property {HTMLButtonElement} [previous]
 * @property {HTMLButtonElement} [next]
 *
 * @extends {Component<Refs>}
 */
export class Slideshow extends Component {
  static get observedAttributes() {
    return ['initial-slide'];
  }

  /**
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    // Collection page filtering will Morph slideshow galleries in place, updating
    // the slideshow[initial-slide] and slideshow-slide[hidden] attributes.
    // We need to re-select() the slide after the morph is complete, but not before
    // slideshow-slide elements have their [hidden] attribute updated.
    if (name === 'initial-slide' && oldValue !== newValue) {
      queueMicrotask(() => {
        // Only select if the component is connected and initialized
        if (!this.isConnected || !this.#scroll || !this.refs.slides) return;
        const index = parseInt(newValue, 10) || 0;
        const slide_id = this.refs.slides[index]?.getAttribute('slide-id');
        if (slide_id) {
          this.select({ id: slide_id }, undefined, { animate: false });
        }
      });
    }
  }

  requiredRefs = ['scroller'];

  async connectedCallback() {
    super.connectedCallback();

    // Register with shared viewport observer for lazy scroll enablement.
    // This prevents iOS Safari crashes caused by too many compositor layers.
    SlideshowViewportObserver.getInstance().observe(this);

    // Wait for any in-progress view transitions to finish
    if (viewTransition.current) {
      await viewTransition.current;
      // It's possible that the slideshow was disconnected before the view transition finished
      if (!this.isConnected) return;
    }

    const slideCount = this.slides?.length || 0;
    slideCount <= 1 ? this.#setupSlideshowWithoutControls() : this.#setupSlideshow();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Unregister from shared viewport observer
    SlideshowViewportObserver.getInstance().unobserve(this);

    if (this.#scroll) {
      const { scroller } = this.refs;
      scroller.removeEventListener('mousedown', this.#handleMouseDown);
      this.#scroll.destroy();
    }

    const slideCount = this.slides?.length || 0;
    if (slideCount > 1) {
      this.removeEventListener('mouseenter', this.suspend);
      this.removeEventListener('mouseleave', this.resume);
      this.removeEventListener('pointerenter', this.#handlePointerEnter);
      document.removeEventListener('visibilitychange', this.#handleVisibilityChange);
    }

    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
    }

    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
      this.#intersectionObserver = null;
    }
  }

  /** Indicates whether the slideshow is nested inside another slideshow. */
  get isNested() {
    return this.parentElement?.closest('slideshow-component') !== null;
  }

  get initialSlide() {
    return this.refs.slides?.[this.initialSlideIndex];
  }

  /**
   * Selects a slide based on the input index.
   * @param {number|string|{id: string}} input - The index or id of the slide to select.
   * @param {Event} [event] - The event that triggered the selection.
   * @param {Object} [options] - The options for the selection.
   * @param {boolean} [options.animate=true] - Whether to animate the selection.
   */
  async select(input, event, options = {}) {
    if (this.#disabled || !this.refs.slides?.length) return;
    if (!this.#scroll) return;

    // Store the actual current slide before any mutations
    const currentSlide = this.slides?.[this.current];

    for (const slide of this.refs.slides) {
      if (slide.hasAttribute('reveal')) {
        slide.removeAttribute('reveal');
        slide.setAttribute('aria-hidden', 'true');
      }
    }

    // Figure out the raw desired index (could be -1 if user is on first slide and clicks prev)
    let requestedIndex = (() => {
      if (typeof input === 'number') return input;
      if (typeof input === 'string') return parseInt(input, 10);
      if ('id' in input) {
        const requestedSlide = this.refs.slides.find((slide) => slide.getAttribute('slide-id') == input.id);

        if (!requestedSlide || !this.slides) return;

        // Force the slide to be revealed if it is hidden
        if (requestedSlide.hasAttribute('hidden')) {
          requestedSlide.setAttribute('reveal', '');
          requestedSlide.setAttribute('aria-hidden', 'false');
        }

        return this.slides.indexOf(requestedSlide);
      }
    })();

    const { current } = this;
    const { slides } = this;

    // Guard checks: no slides, invalid index, or selecting the same slide
    if (!slides?.length || requestedIndex === undefined || isNaN(requestedIndex)) return;

    const requestedSlideElement = slides?.[requestedIndex];
    if (currentSlide === requestedSlideElement) return;

    if (!this.infinite) requestedIndex = clamp(requestedIndex, 0, slides.length - 1);

    event?.preventDefault();

    const { animate = true } = options;
    const lastIndex = slides.length - 1;

    // Decide the actual target index (clamp for infinite loop)
    let index = requestedIndex;
    if (requestedIndex < 0) index = lastIndex;
    else if (requestedIndex > lastIndex) index = 0;

    const isAdjacentSlide = Math.abs(index - current) <= 1 && requestedIndex >= 0 && requestedIndex <= lastIndex;
    const { visibleSlides } = this;
    const instant = prefersReducedMotion() || !animate;

    // If jump is more than 1 or we looped, do the placeholder + reorder trick
    if (!instant && !isAdjacentSlide && visibleSlides.length === 1) {
      this.#disabled = true;
      await this.#scroll.finished; // ensure we're not mid-scroll

      const targetSlide = slides[index];
      if (!targetSlide || !currentSlide) return;

      // Create a placeholder in the original DOM position of targetSlide
      const placeholder = document.createElement('slideshow-slide');
      targetSlide.before(placeholder);

      // Decide whether targetSlide goes before or after currentSlide
      // so that we scroll a short distance in the correct direction
      if (requestedIndex < current) {
        currentSlide.before(targetSlide);
      } else {
        currentSlide.after(targetSlide);
      }

      if (current === 0) this.#scroll.to(currentSlide, { instant: true });

      // Once that scroll finishes, restore the DOM
      queueMicrotask(async () => {
        await this.#scroll.finished;
        this.#disabled = false;

        // Restore the slide back to its original position. This triggers a scroll event.
        placeholder.replaceWith(targetSlide);

        // Instantly scroll to the target slide as its position will have changed
        this.#scroll.to(targetSlide, { instant: true });

        // Force Safari to recalculate the timeline state on timeline refresh (after loop)
        requestAnimationFrame(() => {
          this.setAttribute('refreshing-timeline', '');
          requestAnimationFrame(() => {
            this.removeAttribute('refreshing-timeline');
          });
        });
      });
    }

    const slide = slides[index];
    if (!slide) return;

    const previousIndex = this.current;

    slide.setAttribute('aria-hidden', 'false');

    if (this.#scroll) {
      this.#scroll.to(slide, { instant });
    }

    this.current = this.slides?.indexOf(slide) || 0;

    this.#centerSelectedThumbnail(index, instant ? 'instant' : 'smooth');

    this.dispatchEvent(
      new SlideshowSelectEvent({
        index,
        previousIndex,
        userInitiated: event != null,
        trigger: 'select',
        slide,
        id: slide.getAttribute('slide-id'),
      })
    );
  }

  /**
   * Advances to the next slide.
   * @param {Event} [event] - The event that triggered the next slide.
   * @param {Object} [options] - The options for the next slide.
   * @param {boolean} [options.animate=true] - Whether to animate the next slide.
   */
  next(event, options) {
    event?.preventDefault();
    this.select(this.nextIndex, event, options);
  }

  /**
   * Goes back to the previous slide.
   * @param {Event} [event] - The event that triggered the previous slide.
   * @param {Object} [options] - The options for the previous slide.
   * @param {boolean} [options.animate=true] - Whether to animate the previous slide.
   */
  previous(event, options) {
    event?.preventDefault();
    this.select(this.previousIndex, event, options);
  }

  /**
   * Starts automatic slide playback.
   * @param {number} [interval] - The time interval in seconds between slides.
   */
  play(interval = this.autoplayInterval) {
    if (this.#interval) return;

    this.paused = false;

    this.#interval = setInterval(() => {
      if (this.matches(':hover') || document.hidden) return;

      this.next();
    }, interval);
  }

  /**
   * Pauses automatic slide playback.
   */
  pause() {
    this.paused = true;
    this.suspend();
  }

  get paused() {
    return this.hasAttribute('paused');
  }

  set paused(value) {
    if (value) {
      this.setAttribute('paused', '');
    } else {
      this.removeAttribute('paused');
    }
  }

  /**
   * Suspends automatic slide playback.
   */
  suspend() {
    clearInterval(this.#interval);
    this.#interval = undefined;
  }

  /**
   * Resumes automatic slide playback if autoplay is enabled.
   */
  resume() {
    if (!this.autoplay || this.paused) return;

    this.pause();
    this.play();
  }

  get autoplay() {
    return Boolean(this.autoplayInterval);
  }

  get autoplayInterval() {
    const interval = this.getAttribute('autoplay');
    const value = parseInt(`${interval}`, 10);

    if (Number.isNaN(value)) return undefined;

    return value * 1000;
  }

  /**
   * The current slide index.
   * @type {number}
   */
  #current = 0;

  get current() {
    return this.#current;
  }

  #updateActiveDot() {
    const liveDots = this.querySelectorAll('.slideshow-controls__dots button');
    const { dots, scroller, slides } = this.refs;
    const dotsToUpdate = liveDots.length ? Array.from(liveDots) : (dots || []);
    if (!dotsToUpdate.length) return;

    let closestDotIndex = 0;

    if (scroller && scroller.scrollWidth > scroller.offsetWidth) {
      const scrollLeft = scroller.scrollLeft;
      const maxScroll = scroller.scrollWidth - scroller.offsetWidth;

      if (scrollLeft <= 15) {
        closestDotIndex = 0;
      } else if (scrollLeft + scroller.offsetWidth >= scroller.scrollWidth - 15) {
        closestDotIndex = dotsToUpdate.length - 1;
      } else if (slides?.length) {
        const baseOffset = slides[0].offsetLeft;
        let minDistance = Infinity;

        dotsToUpdate.forEach((el, i) => {
          const targetIndexAttr = el.dataset.targetIndex;
          const targetIndex = targetIndexAttr !== undefined ? parseInt(targetIndexAttr, 10) : i;
          const targetSlide = slides[targetIndex] || slides[i];

          if (targetSlide) {
            const targetScroll = targetSlide.offsetLeft - baseOffset;
            const distance = Math.abs(scrollLeft - targetScroll);
            if (distance < minDistance) {
              minDistance = distance;
              closestDotIndex = i;
            }
          }
        });
      } else {
        closestDotIndex = Math.min(
          dotsToUpdate.length - 1,
          Math.max(0, Math.round((scrollLeft / maxScroll) * (dotsToUpdate.length - 1)))
        );
      }
    } else {
      let minDistance = Infinity;
      const value = this.current;
      dotsToUpdate.forEach((el, i) => {
        const targetIndexAttr = el.dataset.targetIndex;
        const targetIndex = targetIndexAttr !== undefined ? parseInt(targetIndexAttr, 10) : i;
        const distance = Math.abs(targetIndex - value);
        if (distance < minDistance) {
          minDistance = distance;
          closestDotIndex = i;
        }
      });
    }

    dotsToUpdate.forEach((el, i) => {
      const isSelected = i === closestDotIndex;
      const currentSelected = el.getAttribute('aria-selected');
      if (currentSelected !== `${isSelected}`) {
        el.setAttribute('aria-selected', `${isSelected}`);
      }
    });
  }

  /**
   * Sets the current slide index and update the DOM
   * @type {number}
   */
  set current(value) {
    const { current, thumbnails } = this.refs;

    this.#current = value;

    if (current) current.textContent = `${value + 1}`;

    if (thumbnails) {
      thumbnails.forEach((el, i) => el.setAttribute('aria-selected', `${i === value}`));
    }

    this.#updateActiveDot();
    this.#updateNavigationButtons();
  }

  get infinite() {
    return this.getAttribute('infinite') != null;
  }

  get visibleSlides() {
    return this.#visibleSlides;
  }

  get columnsCount() {
    const columnCountCss = getComputedStyle(this).getPropertyValue('--column-count');
    if (columnCountCss) {
      const parsed = parseInt(columnCountCss.trim(), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const { scroller } = this.refs;
    const { slides } = this;
    if (scroller && slides?.[0]) {
      const scrollerWidth = scroller.offsetWidth;
      const slideWidth = slides[0].offsetWidth;
      if (scrollerWidth > 0 && slideWidth > 0) {
        return Math.max(1, Math.floor(scrollerWidth / slideWidth + 0.1));
      }
    }
    return 1;
  }

  get previousIndex() {
    const { current } = this;
    return current - this.columnsCount;
  }

  get nextIndex() {
    const { current } = this;
    return current + this.columnsCount;
  }

  get atStart() {
    const { current, slides } = this;

    return slides?.length ? current === 0 : false;
  }

  get atEnd() {
    const { current, slides } = this;

    return slides?.length ? current === slides.length - 1 : false;
  }

  /**
   * Sets the disabled attribute.
   * @param {boolean} value - The value to set the disabled attribute to.
   */
  set disabled(value) {
    this.setAttribute('disabled', String(value));
  }
  /**
   * Whether the slideshow is disabled.
   * @type {boolean}
   */
  get disabled() {
    return (
      this.getAttribute('disabled') === 'true' || (this.hasAttribute('mobile-disabled') && !mediaQueryLarge.matches)
    );
  }

  /**
   * Indicates whether the slideshow is temporarily disabled (e.g., during infinite loop transition).
   * @type {boolean}
   */
  #disabled = false;

  /**
   * The interval ID for automatic playback.
   * @type {number|undefined}
   */
  #interval = undefined;

  /**
   * The Scroller instance that manages scrolling.
   * @type {Scroller}
   */
  #scroll;

  /**
   * The ResizeObserver instance for monitoring scroller size changes
   * @type {ResizeObserver}
   */
  #resizeObserver;

  /**
   * IntersectionObserver for efficient visibility tracking of slides
   * @type {IntersectionObserver | null}
   */
  #intersectionObserver = null;

  /**
   * Cached visible slides result from IntersectionObserver
   * @type {HTMLElement[]}
   */
  #visibleSlides = [];

  /**
   * Setup the slideshow without controls for zero or one slides
   */
  #setupSlideshowWithoutControls() {
    this.current = 0;
    if (this.hasAttribute('auto-hide-controls')) {
      const { slideshowControls } = this.refs;
      if (slideshowControls instanceof HTMLElement) {
        slideshowControls.hidden = true;
      }
    }

    if (this.refs.slides?.[0]) {
      this.refs.slides[0].setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Setup the slideshow with controls for when there are multiple slides
   */
  #setupSlideshow() {
    // Setup IntersectionObserver first for efficient visibility tracking
    this.#setupIntersectionObserver();

    // Setup the scroll instance
    const { scroller } = this.refs;
    this.#scroll = new Scroller(scroller, {
      onScroll: this.#handleScroll,
      onScrollStart: this.#onTransitionInit,
      onScrollEnd: this.#onTransitionEnd,
    });

    scroller.addEventListener('mousedown', this.#handleMouseDown);

    this.addEventListener('mouseenter', this.suspend);
    this.addEventListener('mouseleave', this.resume);
    this.addEventListener('pointerenter', this.#handlePointerEnter);
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);

    this.#updateControlsVisibility();

    this.disabled = this.isNested || this.disabled;

    this.resume();

    this.current = this.initialSlideIndex;

    // Batch reads and writes to the DOM
    scheduler.schedule(() => {
      let visibleSlidesAmount = 0;
      const initialSlideId = this.initialSlide?.getAttribute('slide-id');

      // Wait for next frame to ensure layout is fully calculated before setting initial scroll position
      // This prevents race conditions on Safari mobile when section_width is 'full-width'
      requestAnimationFrame(() => {
        if (this.initialSlideIndex !== 0 && initialSlideId) {
          this.select({ id: initialSlideId }, undefined, { animate: false });
          visibleSlidesAmount = 1;
        } else {
          visibleSlidesAmount = this.#updateVisibleSlides();
          if (visibleSlidesAmount === 0) {
            this.select(0, undefined, { animate: false });
            visibleSlidesAmount = 1;
          }
        }
      });

      this.#resizeObserver = new ResizeObserver(async () => {
        if (viewTransition.current) await viewTransition.current;

        if (visibleSlidesAmount > 1) {
          this.#updateVisibleSlides();
        }

        if (this.hasAttribute('auto-hide-controls')) {
          this.#updateControlsVisibility();
        }
      });

      if (this.refs.slideshowContainer) {
        this.#resizeObserver.observe(this.refs.slideshowContainer);
      }
      if (this.slides?.[0]) {
        this.#resizeObserver.observe(this.slides[0]);
      }
    });
  }

  /**
   * Callback invoked on user initiated scroll to sync the current slide index
   * and emit a slide change event if the index has changed.
   */
  #handleScroll = () => {
    this.#updateActiveDot();

    const previousIndex = this.#current;
    const index = this.#sync();

    if (index === previousIndex) return;

    const slide = this.slides?.[index];
    if (!slide) return;

    this.dispatchEvent(
      new SlideshowSelectEvent({
        index,
        previousIndex,
        userInitiated: true,
        trigger: 'scroll',
        slide,
        id: slide.getAttribute('slide-id'),
      })
    );
  };

  #onTransitionInit = () => {
    this.setAttribute('transitioning', '');
  };

  #onTransitionEnd = () => {
    this.#updateVisibleSlides();
    this.removeAttribute('transitioning');
  };

  /**
   * Synchronizes the scroll position and updates the current slide index.
   * @returns {number} The index of the current slide.
   */
  #sync = () => {
    const { slides } = this;
    if (!slides) return (this.current = 0);

    if (!this.#scroll) return (this.current = 0);

    const visibleSlides = this.visibleSlides;

    if (!visibleSlides.length) return this.current;

    const { axis } = this.#scroll;
    const { scroller } = this.refs;
    const centers = visibleSlides.map((slide) => center(slide, axis));
    const referencePoint = visibleSlides.length > 1 ? scroller.getBoundingClientRect()[axis] : center(scroller, axis);
    const closestCenter = closest(centers, referencePoint);
    const closestVisibleSlide = visibleSlides[centers.indexOf(closestCenter)];

    if (!closestVisibleSlide) return this.current;

    const index = slides.indexOf(closestVisibleSlide);

    return (this.current = index);
  };

  #dragging = false;

  /**
   * Handles the 'mousedown' event to start dragging slides.
   * @param {MouseEvent} event - The mousedown event.
   */
  #handleMouseDown = (event) => {
    const { slides } = this;

    if (!slides || slides.length <= 1) return;
    if (!(event.target instanceof Element)) return;
    if (this.disabled || this.#dragging) return;

    // Check if the event target is within a 3D model interactive element
    // This prevents the slideshow from capturing drag events when interacting with 3D models
    if (event.target.closest('model-viewer')) {
      return;
    }

    event.preventDefault();
    // Store initial position but don't start handling yet
    const { axis } = this.#scroll;
    const startPosition = event[axis];

    const controller = new AbortController();
    const { signal } = controller;
    const startTime = performance.now();
    let previous = startPosition;
    let velocity = 0;
    let moved = false;
    let distanceTravelled = 0;

    this.#dragging = true;

    /**
     * Handles the 'pointermove' event to update the scroll position.
     * @param {PointerEvent} event - The pointermove event.
     */
    const onPointerMove = (event) => {
      const current = event[axis];
      const initialDelta = startPosition - current;

      if (!initialDelta) return;

      if (!moved) {
        moved = true;
        this.setPointerCapture(event.pointerId);

        // Prevent clicks once the user starts dragging
        document.addEventListener('click', preventDefault, { once: true, signal });

        const movingRight = initialDelta < 0;
        const movingLeft = initialDelta > 0;

        // Check if the current slideshow should handle this drag
        const closestSlideshow = this.parentElement?.closest('slideshow-component');
        const isNested = closestSlideshow instanceof Slideshow && closestSlideshow !== this;
        const cannotMoveInDirection = (movingRight && this.atStart) || (movingLeft && this.atEnd);

        // Abort and let the parent slideshow handle the drag if we're moving in a direction where nested slideshow can't move
        if (isNested && cannotMoveInDirection) {
          controller.abort();
          return;
        }

        this.pause();
        this.setAttribute('dragging', '');
      }

      // Stop the event from bubbling up to parent slideshow components
      event.stopImmediatePropagation();

      const delta = previous - current;
      const timeDelta = performance.now() - startTime;
      velocity = Math.round((delta / timeDelta) * 1000);
      previous = current;
      distanceTravelled += Math.abs(delta);

      this.#scroll.by(delta, { instant: true });
    };

    /**
     * Handles the 'pointerup' event to stop dragging slides.
     * @param {PointerEvent} event - The pointerup event.
     */
    const onPointerUp = async (event) => {
      controller.abort();
      const { current, slides } = this;
      const { scroller } = this.refs;

      this.#dragging = false;

      if (!slides?.length || !scroller) return;

      const overallDelta = startPosition - event[axis];
      const direction = Math.sign(overallDelta);
      const next = this.#sync();

      const modifier = current !== next || Math.abs(velocity) < 150 || distanceTravelled < 40 ? 0 : direction;
      const newIndex = clamp(next + modifier, 0, slides.length - 1);

      const newSlide = slides[newIndex];
      const currentIndex = this.current;

      if (!newSlide) throw new Error(`Slide not found at index ${newIndex}`);

      this.#scroll.to(newSlide);

      this.removeAttribute('dragging');
      this.releasePointerCapture(event.pointerId);

      this.#centerSelectedThumbnail(newIndex);

      this.dispatchEvent(
        new SlideshowSelectEvent({
          index: newIndex,
          previousIndex: currentIndex,
          userInitiated: true,
          trigger: 'drag',
          slide: newSlide,
          id: newSlide.getAttribute('slide-id'),
        })
      );

      this.current = newIndex;

      await this.#scroll.finished;

      // It's possible that the user started dragging again before the scroll finished
      if (this.#dragging) return;

      this.#scroll.snap = true;
      this.resume();
    };

    this.#scroll.snap = false;

    document.addEventListener('pointermove', onPointerMove, { signal });
    document.addEventListener('pointerup', onPointerUp, { signal });
    /**
     * pointerDown calls onPointerUp to fix an issue where the first tap-and-drag
     * on the zoom dialog is captured by the pointerMove/pointerUp listeners,
     * sometimes causing the slideshow to change slides unexpectedly
     */
    document.addEventListener('pointerdown', onPointerUp, { signal });
    document.addEventListener('pointercancel', onPointerUp, { signal });
    document.addEventListener('pointercapturelost', onPointerUp, { signal });
  };

  #handlePointerEnter = () => {
    this.setAttribute('actioned', '');
  };

  get slides() {
    return this.refs.slides?.filter((slide) => !slide.hasAttribute('hidden') || slide.hasAttribute('reveal'));
  }

  /**
   * The initial slide index.
   * @type {number}
   */
  get initialSlideIndex() {
    const initialSlide = this.getAttribute('initial-slide');
    if (initialSlide == null) return 0;

    return parseInt(initialSlide, 10);
  }

  /**
   * Pause the slideshow when the page is hidden.
   */
  #handleVisibilityChange = () => (document.hidden ? this.suspend() : this.resume());

  #updateNavigationButtons() {
    const { previous, next, scroller } = this.refs;
    if (!scroller) return;

    if (previous) {
      previous.disabled = Boolean(!this.infinite && scroller.scrollLeft <= 5);
    }
    if (next) {
      next.disabled = Boolean(!this.infinite && scroller.scrollLeft + scroller.offsetWidth >= scroller.scrollWidth - 5);
    }
  }

  #updateControlsVisibility() {
    if (!this.hasAttribute('auto-hide-controls')) return;

    const { scroller, slideshowControls } = this.refs;

    if (!scroller || !(slideshowControls instanceof HTMLElement)) return;

    slideshowControls.hidden = scroller.scrollWidth <= scroller.offsetWidth;
  }

  /**
   * Setup IntersectionObserver for efficient visibility tracking of slides
   */
  #setupIntersectionObserver() {
    const { slides, scroller } = this.refs;
    if (!slides?.length) return;

    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect();
    }

    this.#intersectionObserver = new IntersectionObserver(
      (entries) => {
        const allEntries = [
          ...entries,
          ...(this.#intersectionObserver ? this.#intersectionObserver.takeRecords() : []),
        ];

        for (const entry of allEntries) {
          const slide = /** @type {HTMLElement} */ (entry.target);
          const isCurrentlyVisible = this.#visibleSlides.includes(slide);
          const shouldBeVisible = entry.intersectionRatio >= SLIDE_VISIBLITY_THRESHOLD;

          if (shouldBeVisible && !isCurrentlyVisible) {
            this.#visibleSlides.push(slide);
          } else if (!shouldBeVisible && isCurrentlyVisible) {
            const index = this.#visibleSlides.indexOf(slide);
            if (index > -1) {
              this.#visibleSlides.splice(index, 1);
            }
          }
        }

        this.#visibleSlides.sort((a, b) => slides.indexOf(a) - slides.indexOf(b));
        this.#updateVisibleSlides();
      },
      {
        root: scroller,
        threshold: SLIDE_VISIBLITY_THRESHOLD,
        // Add small margin to account for sub-pixel rendering
        rootMargin: '1px',
      }
    );

    // Observe all slides - observer will fire initial callback asynchronously
    slides.forEach((slide) => {
      this.#intersectionObserver?.observe(slide);
    });
  }

  /**
   * Centers the selected thumbnail in the thumbnails container
   * @param {number} index - The index of the selected thumbnail
   * @param {ScrollBehavior} [behavior] - The scroll behavior.
   */
  #centerSelectedThumbnail(index, behavior = 'smooth') {
    const selectedThumbnail = this.refs.thumbnails?.[index];
    if (!selectedThumbnail) return;

    const { thumbnailsContainer } = this.refs;
    if (!thumbnailsContainer || !(thumbnailsContainer instanceof HTMLElement)) return;

    const { slideshowControls } = this.refs;
    if (!slideshowControls || !(slideshowControls instanceof HTMLElement)) return;

    scrollIntoView(selectedThumbnail, {
      ancestor: thumbnailsContainer,
      behavior,
      block: 'center',
      inline: 'center',
    });
  }

  #updateVisibleSlides() {
    const { slides } = this;
    if (!slides || !slides.length) return 0;

    const visibleSlides = this.visibleSlides;

    // If the IntersectionObserver reports zero visible slides, then the slideshow has intersected, but no slides meet the visibility threshold.
    // Probably that the slideshow's host is mid-animation or zero-layout, like in an animating modal.
    // Don't stamp aria-hidden="true" on every slide. Set the current slide to the first visible slide.
    if (visibleSlides.length === 0) return 0;

    // Calculate page count and rebuild dot buttons
    const scroller = this.refs.scroller;
    if (scroller) {
      const visibleColumns = this.columnsCount;
      const dotsContainer = this.querySelector('.slideshow-controls__dots');
      if (dotsContainer) {
        const totalPages = Math.ceil(slides.length / Math.max(1, visibleColumns));

        if (totalPages <= 1) {
          dotsContainer.innerHTML = '';
          dotsContainer.hidden = true;
          dotsContainer.style.display = 'none';
          return;
        } else {
          dotsContainer.hidden = false;
          dotsContainer.style.removeProperty('display');
        }

        const currentDotButtons = dotsContainer.querySelectorAll('button');
        let needsRebuild = currentDotButtons.length !== totalPages;
        const maxScrollIndex = Math.max(0, slides.length - visibleColumns);
        if (!needsRebuild) {
          for (let i = 0; i < totalPages; i++) {
            const targetIndex = Math.min(i * visibleColumns, maxScrollIndex);
            if (currentDotButtons[i].dataset.targetIndex !== String(targetIndex)) {
              needsRebuild = true;
              break;
            }
          }
        }

        if (needsRebuild) {
          let newHtml = '';
          for (let i = 0; i < totalPages; i++) {
            const targetIndex = Math.min(i * visibleColumns, maxScrollIndex);
            newHtml += `
              <li>
                <button
                  class="slideshow-control button button-unstyled"
                  style="animation-timeline: --slide-${targetIndex}"
                  aria-label="Go to page ${i + 1} of ${totalPages}"
                  on:click="/select/${targetIndex}"
                  ref="dots[]"
                  data-target-index="${targetIndex}"
                >
                  ${i + 1}
                </button>
              </li>
            `;
          }
          dotsContainer.innerHTML = newHtml;
          dotsContainer.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', (e) => {
              e.preventDefault();
              const targetIndex = parseInt(button.dataset.targetIndex, 10);
              this.select(targetIndex);
            });
          });
          this.#updateActiveDot();
        } else {
          this.#updateActiveDot();
        }
      }
    }

    this.#updateNavigationButtons();

    // Batch writes to the DOM
    scheduler.schedule(() => {
      // Update aria-hidden based on visibility
      slides.forEach((slide) => {
        const isVisible = visibleSlides.includes(slide);
        slide.setAttribute('aria-hidden', `${!isVisible}`);
      });
    });

    return visibleSlides.length;
  }
}

if (!customElements.get('slideshow-component')) {
  customElements.define('slideshow-component', Slideshow);
}
