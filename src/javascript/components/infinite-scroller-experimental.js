define('components/infinite-scroller-experimental',[
], function() {
    'use strict';
    
    const PHYSICAL_ITEMS = 20;
    const PAGE_SIZE = 10;
    const PROXIMITY_BOUNDARY = 300;

    class InfiniteScroller {

        constructor(scroller, dataSource, options) {
            this.scroller = scroller;
            this.dataSource = dataSource;

            // Options
            this.swipeable = options.swipeable;
            this.PHYSICAL_ITEMS = options.physicalItems || PHYSICAL_ITEMS;
            this.PAGE_SIZE = options.pageSize || PAGE_SIZE;
            this.PROXIMITY_BOUNDARY = options.proximityBoundary || PROXIMITY_BOUNDARY;
            
            // This will hold a cache of the data sent from server
            this.itemsCacheData = [];

            this.loadingItemHeight = 0;
            this.loadingItemWidth = 0;
            this.loadingItems = [];

            this.physicalItems = [];
            this.firstPhysicalItemIndex = -1;
            this.middlePhysicalItemIndex = -1;
            this.lastPhysicalItemIndex = -1;
            this.firstPhysicalItem = null;
            this.lastPhysicalItem = null;
            this.firstPhysicalItemTranslateY = 0;
            this.lastPhysicalItemTranslateY = 0;

            this.requestInProgress = false;

            // Reference to current item
            this.target = null;
            this.targetBCR = null;
            this.targetX = 0;
            this.startX = 0;
            this.currentX = 0;
            this.translateX = 0;
            this.draggingItem = false;

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

            this.onResize();
            this.loadItems();
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

        onResize(e) {
            // On resize need to recalculate the translateY values for the elements
            const loadingItem = this.dataSource.createLoadingElement();
            this.scroller.appendChild(loadingItem);
            this.loadingItemHeight = loadingItem.offsetHeight;
            this.loadingItemWidth = loadingItem.offsetWidth;
            this.scroller.removeChild(loadingItem);

            // this.onScroll();
        }

        /**
         * It then updates the visible
         * elements, requesting more items from the dataSource if we have scrolled
         * past the end of currently available content.
         */
        onScroll(e) {
            if (this.requestInProgress) {
                return;
            }

            const delta = this.scroller.scrollTop - this.previousScrollTop;
            this.previousScrollTop = this.scroller.scrollTop;

            /**
             * if delta is greater than 0 then user is scrolling down
             */
            if (delta > 0) {
                const actualLastPhysicalItemTranslateY = this.lastPhysicalItemTranslateY - (this.lastPhysicalItem.offsetHeight + 10);
                const proximityToLastPhysicalItem = actualLastPhysicalItemTranslateY - (this.scroller.scrollTop + this.scroller.offsetHeight);

                if (!this.requestInProgress && (proximityToLastPhysicalItem < this.PROXIMITY_BOUNDARY)) {
                    this.loadItems();
                }

            } else if (delta < 0) {
                const proximityToFirstPhysicalItem = this.scroller.scrollTop - this.firstPhysicalItemTranslateY;

                if (!this.requestInProgress && this.firstPhysicalItemIndex !== 0 && (proximityToFirstPhysicalItem < this.PROXIMITY_BOUNDARY)) {
                    this.loadItemsUp();
                }
            }
        }

        loadItems() {
            this.requestInProgress = true;

            let loadingHeight = this.lastPhysicalItemTranslateY;

            // instead of appending 10 times, just append once
            // let addingElems = false;
            // const frag = document.createDocumentFragment();

            // Loading items
            for (let i = 0; i < this.PAGE_SIZE; i += 1) {
                const hasLoadingItem = this.loadingItems[i];
                const loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();

                loadingItem.style.position = 'absolute';
                loadingItem.style.transform = `translateY(${loadingHeight}px)`;
                loadingItem.style.width = '92%';
                loadingItem.classList.remove('invisible');

                // If loading item not in DOM then add it
                if (!hasLoadingItem) {
                    // addingElems = true;
                    // frag.appendChild(loadingItem);
                    this.scroller.appendChild(loadingItem);
                }

                this.loadingItems[i] = loadingItem;

                loadingHeight += this.loadingItemHeight + 10; // loadingHeight is more of loadingTranslateYValue
            }

            // instead of appending 10 times, just append once
            // if (addingElems) {
            //     this.scroller.appendChild(frag);
            // }

            const nextIndexToPopulate = this.lastPhysicalItemIndex + 1;
            // Check the cache
            if (this.itemsCacheData[nextIndexToPopulate]) {
                // use cache to populate items
                this.populateItems(this.itemsCacheData.slice(nextIndexToPopulate, nextIndexToPopulate + 10), true);
            } else {
                // 10 items
                this.dataSource.next().then((response) => {
                    this.populateItems(response, false);
                });
            }
        }

        populateItems(items, fromCache) {
            const currentCacheDataLength = this.itemsCacheData.length;
            const nextIndexToPopulate = this.lastPhysicalItemIndex + 1;

            // let itemTranslateY = 0;
            let itemTranslateY = this.lastPhysicalItemTranslateY;

            for (let i = 0; i < items.length; i += 1) {

                if (this.loadingItems[i]) {
                    this.loadingItems[i].classList.add('invisible');
                }

                const itemIndex = (nextIndexToPopulate + i) % this.PHYSICAL_ITEMS;
                const hasReusableItem = this.physicalItems[itemIndex];
                const item = hasReusableItem ? this.dataSource.render(items[i], this.physicalItems[itemIndex]) : this.dataSource.render(items[i]);

                item.style.position = 'absolute';
                item.style.transform = `translateY(${itemTranslateY}px)`;
                item.dataset.translateY = itemTranslateY;
                item.style.width = '92%';

                if (!hasReusableItem) {
                    this.scroller.appendChild(item);
                }

                // We need to show right scrollbar size
                if (!fromCache) {
                    this.scrollRunwayEnd += item.offsetHeight + 10; // make 10 a constant
                }
                itemTranslateY += item.offsetHeight + 10;
                
                this.physicalItems[itemIndex] = item;
                // this.itemsCacheData.push(items[i]);
                this.itemsCacheData[currentCacheDataLength + i] = items[i];
            }
            
            // This uses the updated physicalItemIndex props
            this.calculatePhysicalItemsIndex(items.length);

            // Update runway translate to update scrollbar
            this.scrollRunway.style.transform = `translate(0,${this.scrollRunwayEnd}px)`;
            this.requestInProgress = false;
        }

        loadItemsUp() {
            this.requestInProgress = true;

            let loadingItemTranslateY = this.firstPhysicalItemTranslateY;

            for (let i = 9; i >= 0; i -= 1) {

                const hasLoadingItem = this.loadingItems[i];
                const loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();

                loadingItem.style.position = 'absolute';
                loadingItem.style.transform = `translateY(${loadingItemTranslateY}px)`;
                loadingItem.style.width = '92%';
                loadingItem.classList.remove('invisible');

                // If loading item not in DOM then add it
                if (!hasLoadingItem) {
                    // addingElems = true;
                    // frag.appendChild(loadingItem);
                    this.scroller.appendChild(loadingItem);
                }

                this.loadingItems[i] = loadingItem;

                loadingItemTranslateY -= (this.loadingItemHeight + 10);
            }

            this.populateItemsTop();
        }

        populateItemsTop() {

            const itemBeforeFirstPhysicalItemIndex = this.firstPhysicalItemIndex - 1;

            let itemTranslateY = this.firstPhysicalItemTranslateY;

            for (let i = itemBeforeFirstPhysicalItemIndex; i > itemBeforeFirstPhysicalItemIndex - 10; i -= 1) {

                if (this.loadingItems[i % 10]) {
                    this.loadingItems[i % 10].classList.add('invisible');
                }

                const reusableItemIndex = i % this.PHYSICAL_ITEMS;
                const hasItem = this.physicalItems[reusableItemIndex];
                const item = hasItem ? this.dataSource.render(this.itemsCacheData[i], this.physicalItems[reusableItemIndex]) : this.dataSource.render(this.itemsCacheData[i]);

                item.style.position = 'absolute';
                item.style.transform = `translateY(${itemTranslateY}px)`;
                // We need these values to animate elements when removed
                item.dataset.translateY = itemTranslateY;
                item.style.width = '92%';

                // this should never go inside when scrolling up otherwise we messed up
                if (!hasItem) {
                    this.scroller.appendChild(item);
                }

                itemTranslateY -= (item.offsetHeight + 10);
                
                this.physicalItems[reusableItemIndex] = item;
            }

            this.calculatePhysicalItemsIndex(-10);
            this.requestInProgress = false;
        }

        calculatePhysicalItemsIndex(itemsLength) {

            this.lastPhysicalItemIndex += itemsLength;
            this.firstPhysicalItemIndex = Math.max(0, this.lastPhysicalItemIndex - (this.PHYSICAL_ITEMS - 1));
            this.middlePhysicalItemIndex = this.firstPhysicalItemIndex + ((this.lastPhysicalItemIndex - this.firstPhysicalItemIndex + 1) / 2);

            this.firstPhysicalItem = this.physicalItems[this.firstPhysicalItemIndex % this.PHYSICAL_ITEMS];
            this.lastPhysicalItem = this.physicalItems[this.lastPhysicalItemIndex % this.PHYSICAL_ITEMS];

            // this is used for the next
            this.firstPhysicalItemTranslateY = parseInt(this.firstPhysicalItem.dataset.translateY, 10) - (this.firstPhysicalItem.offsetHeight + 10);
            this.lastPhysicalItemTranslateY = parseInt(this.lastPhysicalItem.dataset.translateY, 10) + (this.lastPhysicalItem.offsetHeight + 10);
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

            // Since we are manipulating elements through translates we need to keep translateY
            this.target.style.transform = `translate(${this.translateX}px, ${this.target.dataset.translateY}px)`;
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

                const targetTranslateY = this.target.dataset.translateY;
                this.scroller.removeChild(this.target);
                const targetIndex = this.physicalItems.indexOf(this.target);
                const targetDataIndex = parseInt(this.target.dataset.id, 10);
                this.physicalItems.splice(targetIndex, 1);
                this.itemsCacheData.splice(targetDataIndex - 1, 1);

                this.animateOtherItemsIntoPosition(targetIndex, targetTranslateY);

                // if (this.physicalItems.length < 6) {
                //     this.loadItems();
                // }

            } else if (isNearlyAtStart) {
                this.resetTarget();
            }
        }

        animateOtherItemsIntoPosition(startIndex, translateY) {
            // If removed card was the last one, there is nothing to animate.
            // Remove the target
            if (startIndex === this.physicalItems.length) {
                this.resetTarget();
                return;
            }

            const onAnimationComplete = (e) => {
                const item = e.target;
                item.removeEventListener('transitionend', onAnimationComplete);
                item.style.transition = '';
                // item.style.transform = '';
                // item.style.transform = `translateY(${parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10}px)`;
                // item.dataset.translateY

                this.resetTarget();
            };

            // Set up all card animations
            for (let i = 0; i < this.physicalItems.length; i += 1) {
                const item = this.physicalItems[i];

                if (item.dataset.translateY > translateY) {
                    // Move the card down then slide it up.
                    // item.style.transform = `translateY(${this.targetBCR.height + 10}px)`;
                    item.style.transform = `translateY(${item.dataset.translateY}px)`;
                    item.addEventListener('transitionend', (e) => onAnimationComplete(e));
                }
            }

            // Now init them
            requestAnimationFrame(_ => {
                for (let i = 0; i < this.physicalItems.length; i += 1) {
                    const item = this.physicalItems[i];

                    if (item.dataset.translateY > translateY) {
                        item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1)`;
                        item.style.transform = `translateY(${parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10}px)`;
                        item.dataset.translateY = parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10;
                    }
                }
            });
        }

        resetTarget() {
            if (!this.target) {
                return;
            }

            this.target.style.willChange = 'initial';
            // this.target.style.transform = 'none';
            this.target.style.transform = `translateY(${this.target.dataset.translateY}px)`;
            this.target = null;
        }
    }

    return InfiniteScroller;
});