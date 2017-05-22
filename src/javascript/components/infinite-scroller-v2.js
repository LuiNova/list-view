define('components/infinite-scroller-v2',[
], function() {
    'use strict';
    
    const RUNWAY_ITEMS = 50;
    const RUNWAY_ITEMS_OPPOSITE = 10;
    const SCROLL_RUNWAY = 2000;
    const ANIMATION_DURATION_MS = 200;

    class InfiniteScroller {

        constructor(scroller, dataSource, options) {
            this.scroller = scroller;
            this.dataSource = dataSource;

            this.anchorScrollTop = 0;
            this.loadingItemHeight = 0;
            this.loadingItemWidth = 0;
            this.loadingItems = [];

            this.firstAttachedItem = 0;
            this.lastAttachedItem = 0;
            this.virtualItems = [];
            this.physicalItems = [];

            this.virtualItemsCount = 0;
            this.physicalItemsCount = 0;

            this.items = [];
            this.loadedItems = 0;
            this.requestInProgress = false;

            this.swipeable = options.swipeable;

            // Reference to current item
            this.target = null;
            this.targetBCR = null;
            this.targetX = 0;
            this.startX = 0;
            this.currentX = 0;
            this.translateX = 0;
            this.draggingItem = false;

            // Create element to manage top height
            this.anchorItem = document.createElement('div');
            this.anchorItemHeight = 0;
            // this.anchorItem.style.position = 'absolute';
            this.anchorItem.style.height = '1px';
            this.anchorItem.style.width = '1px';
            // this.anchorItem.style.transition = 'transform 0.2s';
            this.scroller.appendChild(this.anchorItem);

            // Create element to force scroll
            this.scrollRunway = document.createElement('div');
            this.scrollRunwayEndBefore = 0;
            this.scrollRunwayEnd = 0;
            this.scrollRunway.style.position = 'absolute';
            this.scrollRunway.style.height = '1px';
            this.scrollRunway.style.width = '1px';
            this.scrollRunway.style.transition = 'transform 0.2s';
            this.scroller.appendChild(this.scrollRunway);

            this.previousScrollTop = 0;

            this.addEventListeners();

            this.count = 0;

            // this.onResize();
            // this.loadItems();
            this.loadItemsExp(false);
        }

        addEventListeners() {
            window.addEventListener('resize', (e) => this.onResize(e));
            this.scroller.addEventListener('scroll', (e) => this.onScroll(e));

            if (this.swipeable) {
                this.scroller.addEventListener('touchstart', (e) => this.onTouchStart(e));
                this.scroller.addEventListener('touchmove', (e) => this.onTouchMove(e));
                this.scroller.addEventListener('touchend', (e) => this.onTouchEnd(e));
            }
        }

        loadItems() {
            this.requestInProgress = true;

            // loaidng items
            for (let i = 0; i < 10; i += 1) {
                const loadingItem = this.dataSource.createLoadingElement();
                this.loadingItems[i] = loadingItem;
                this.scroller.appendChild(loadingItem);
            }

            // 20 items
            // this.dataSource.next().then((response) => {
            //     this.populateItems(response);
            //     return this.dataSource.next();
            // }).then((response) => {
            //     this.populateItems(response);
            // });

            // 10 items
            this.dataSource.next().then((response) => {
                this.populateItems(response);
                return this.dataSource.next();
            });
        }

        loadItemsExp(firstLoad) {
            if (this.count > 15) {
                return;
            }

            this.requestInProgress = true;
            let loadingHeight = this.scrollRunwayEnd;

            // loaidng items
            for (let i = 0; i < 10; i += 1) {
                const hasLoadingItem = this.loadingItems[i];
                const loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();
                
                this.loadingItems[i] = loadingItem;

                // Experimental - Transform instead of removing elements
                loadingItem.style.position = 'absolute';
                loadingItem.style.transform = `translateY(${loadingHeight}px)`;
                loadingItem.style.width = '92%';
                loadingItem.classList.remove('invisible');

                // If loading item not in DOM then add it
                if (!hasLoadingItem) {
                    this.scroller.appendChild(loadingItem);
                }

                // Experimental - Transform instead of removing elements
                loadingHeight += loadingItem.offsetHeight + 10;
            }

            // console.log('LOADING RUNWAY END: ', this.scrollRunwayEnd);
            // this.scrollRunway.style.transform = `translate(0,${this.loadingHeight}px)`;

            if (firstLoad) {
                console.log('first load');
                let firstLoadItems = [];
                this.dataSource.next().then((response) => {
                    firstLoadItems = firstLoadItems.concat(response);
                    return this.dataSource.next();
                }).then((response) => {
                    firstLoadItems = firstLoadItems.concat(response);
                    this.populateItemsExp(firstLoadItems);
                });
            } else {
                // 10 items
                this.dataSource.next().then((response) => {
                    this.populateItemsExp(response);
                    // return this.dataSource.next();
                });
            }
        }

        populateItems(items) {
            // console.log('Loading: ', this.loadingItems);

            for (let i = 0; i < items.length; i += 1) {

                if (this.loadingItems[0]) {
                    this.scroller.removeChild(this.loadingItems[0]);
                    this.loadingItems.splice(0, 1);
                }
                const item = this.dataSource.render(items[i]);
                this.scroller.appendChild(item);

                this.scrollRunwayEnd += item.offsetHeight + 10;
                this.items.push(item);
            }

            this.scrollRunway.style.transform = `translate(0,${this.scrollRunwayEnd}px)`;
            this.requestInProgress = false;
        }

        populateItemsExp(items) {
            console.log('Hello');
            // console.log('Loading: ', this.loadingItems);

            for (let i = 0; i < items.length; i += 1) {

                if (this.loadingItems[i]) {
                    this.loadingItems[i].classList.add('invisible');
                }

                const itemIndex = (this.firstAttachedItem + i) % 20;
                const hasItem = this.virtualItems[itemIndex] && this.virtualItems.length === 20;

                const item = hasItem ? this.dataSource.render(items[i], this.virtualItems[itemIndex]) : this.dataSource.render(items[i]);

                // Experimental - Transform instead of removing elements
                item.style.position = 'absolute';
                item.style.transform = `translateY(${this.scrollRunwayEnd}px)`;
                item.style.width = '92%';

                if (!hasItem) {
                    this.scroller.appendChild(item);
                }

                this.scrollRunwayEnd += item.offsetHeight + 10;
                
                this.virtualItems[itemIndex] = item;
                this.items.push(item);
            }

            this.lastAttachedItem = this.firstAttachedItem + (items.length - 1);

            this.scrollRunway.style.transform = `translate(0,${this.scrollRunwayEnd}px)`;
            this.requestInProgress = false;
            this.count += 1;
        }

        onResize(e) {
            const loadingItem = this.dataSource.createLoadingElement();
            this.scroller.appendChild(loadingItem);
            this.loadingItemHeight = loadingItem.offsetHeight;
            this.loadingItemWidth = loadingItem.offsetWidth;
            this.scroller.removeChild(loadingItem);

            // Reset cahced size of items in the scroller
            for (let i = 0; i < this.items.length; i += 1) {
                this.items[i].height = this.items[i].width = 0;
            }

            this.onScroll();
        }

        /**
         * It then updates the visible
         * elements, requesting more items from the dataSource if we have scrolled
         * past the end of currently available content.
         */
        onScroll(e) {
            const delta = this.scroller.scrollTop - this.previousScrollTop;
            this.previousScrollTop = this.scroller.scrollTop;

            if (delta > 0) {
                // scrolling down
                const scrollBoundary = this.scroller.scrollTop + this.scroller.offsetHeight + 200;

                if (!this.requestInProgress && (scrollBoundary > this.scroller.scrollHeight)) {
                    // this.loadItems();

                    this.firstAttachedItem = this.lastAttachedItem + 1;

                    this.loadItemsExp();
                    // this.fill(this.anchorItem.index - RUNWAY_ITEMS, lastScreenItem.index + RUNWAY_ITEMS_OPPOSITE);
                }
            } else {
                // scrolling up
                // this.fill(this.anchorItem.index - RUNWAY_ITEMS_OPPOSITE, lastScreenItem.index + RUNWAY_ITEMS);
            }
        }

        /**
         * Sets the range of items which should be attached and attaches those items
         */
        fill(start, end) {
            this.firstAttachedItem = Math.max(0, start);
            this.lastAttachedItem = end;
            this.attachContent();
        }

        getLoadingItem() {
            const loadingItem = this.loadingItems.pop();
            if (loadingItem) {
                return loadingItem;
            }

            return this.dataSource.createLoadingElement();
        }

        attachContent(start, end) {
            // here some logic to go fetch items i.e. scrolling down and not more virtualItems
            // and just loading from virtual items

        }

        addItem() {
            this.items.push({
                data: null,
                node: null
            });
        }

        addContent(items) {
            this.requestInProgress = false;
            for (let i = 0; i < items.length; i += 1) {
                this.addItem();
                this.items[this.loadedItems++].data = items[i];
            }
            this.attachContent();
        }

        onTouchStart(e) {
            if (this.target) {
                return;
            }

            if (!e.target.classList.contains('scroller__item')) {
                return;
            }

            this.target = e.target;
            this.targetBCR = this.target.getBoundingClientRect();
            this.startX = e.touches[0].pageX;
            this.currentX = this.startX;
            // this.translateX = 0;
            this.draggingItem = true;

            this.target.style.willChange = 'transform';

            requestAnimationFrame(() => this.update());

            // e.preventDefault();
        }

        onTouchMove(e) {
            if (!this.target) {
                return;
            }

            this.currentX = e.touches[0].pageX;
        }

        onTouchEnd(e) {
            if (!this.target) {
                return;
            }

            this.targetX = 0;
            let translateX = this.currentX - this.startX;
            const threshold = this.targetBCR.width * 0.35;

            if (Math.abs(translateX) > threshold) {
                this.targetX = (translateX > 0) ? this.targetBCR.width : -this.targetBCR.width;
            }

            this.draggingItem = false;
        }

        update() {
            requestAnimationFrame(() => this.update());

            if (!this.target) {
                return;
            }

            if (this.draggingItem) {
                this.translateX = this.currentX - this.startX;
            } else {
                this.translateX += (this.targetX - this.translateX) / 4;
            }

            const normalizedDragDistance = (Math.abs(this.translateX) / this.targetBCR.width);
            const opacity = 1 - Math.pow(normalizedDragDistance, 3);

            this.target.style.transform = `translateX(${this.translateX}px)`;
            this.target.style.opacity = opacity;

            // User has not finished dragging
            if (this.draggingItem) {
                return;
            }

            const isNearlyAtStart = (Math.abs(this.translateX) < 0.01);
            const isNearlyInvisible = (opacity < 0.01);

            if (isNearlyInvisible) {

                if (!this.target || !this.target.parentNode) {
                    return;
                }

                this.scrollRunwayEnd -= this.target.offsetHeight + 10;
                this.scrollRunway.style.transform = `translate(0,${this.scrollRunwayEnd}px)`;

                this.scroller.removeChild(this.target);
                const targetIndex = this.items.indexOf(this.target);
                this.items.splice(targetIndex, 1);

                this.animateOtherItemsIntoPosition(targetIndex);

                if (this.items.length < 6) {
                    this.loadItems();
                }

            } else if (isNearlyAtStart) {
                this.resetTarget();
            }
        }

        animateOtherItemsIntoPosition(startIndex) {
            // If removed card was the last one, there is nothing to animate.
            // Remove the target
            if (startIndex === this.items.length) {
                this.resetTarget();
                return;
            }

            const onAnimationComplete = (e) => {
                const item = e.target;
                item.removeEventListener('transitionend', onAnimationComplete);
                item.style.transition = '';
                item.style.transform = '';

                this.resetTarget();
            };

            // Set up all card animations
            for (let i = startIndex; i < this.items.length; i += 1) {
                const item = this.items[i];

                // Move the card down then slide it up.
                item.style.transform = `translateY(${this.targetBCR.height + 10}px)`;
                item.addEventListener('transitionend', (e) => onAnimationComplete(e));
            }

            // Now init them
            requestAnimationFrame(_ => {
                for (let i = startIndex; i < this.items.length; i += 1) {
                    const item = this.items[i];

                    // Move the card down then slide it up, with delay according to "distance"
                    // item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1) ${i*50}ms`;
                    item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1)`;
                    item.style.transform = '';
                }
            });
        }

        resetTarget() {
            if (!this.target) {
                return;
            }

            this.target.style.willChange = 'initial';
            this.target.style.transform = 'none';
            this.target = null;
        }
    }

    return InfiniteScroller;
});