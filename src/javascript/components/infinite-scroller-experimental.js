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
            this.anchorItem.style.position = 'absolute';
            this.anchorItem.style.height = '0px';
            this.anchorItem.style.width = '20px';
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
                
                // might not need this
                if (this.requestInProgress) {
                    return;
                }

                // const scrollBoundary = this.scroller.scrollTop + this.scroller.offsetHeight + 200;
                const normalizedLastItemIndex = this.lastPhysicalItemIndex % PHYSICAL_ITEMS;
                const lastItemTranslateY = ++this.physicalItems[normalizedLastItemIndex].dataset.translateY;
                // const proximityToLastPhysicalItem = lastItemTranslateY - (this.scroller.scrollTop + this.scroller.offsetHeight);
                const proximityToLastPhysicalItem = (this.lastPhysicalItemTranslateY - (this.lastPhysicalItem.offsetHeight + 10)) - (this.scroller.scrollTop + this.scroller.offsetHeight);

                // if (!this.requestInProgress && (scrollBoundary > this.virtualItems[normalizedLastItemIndex].dataset.translateY)) {
                if (!this.requestInProgress && (proximityToLastPhysicalItem < 300)) {
                // if (!this.requestInProgress && (scrollBoundary > this.scroller.scrollHeight)) {
                    this.loadItems();
                    // something where we say fill lower bottom
                    // this.fill(this.anchorItem.index - RUNWAY_ITEMS, lastScreenItem.index + RUNWAY_ITEMS_OPPOSITE);
                }

            } else if (delta < 0) {

                if (this.requestInProgress) {
                    return;
                }
                
                // const firstItemIndex = Math.max(0, (this.firstAttachedItem - 10) % PHYSICAL_ITEMS);
                // const firstItemIndex = Math.max(0, (this.firstAttachedItem - 10));
                // const scrollProximity = this.scroller.scrollTop - this.virtualItems[firstItemIndex % PHYSICAL_ITEMS].dataset.translateY;

                const normalizeFirstItemIndex = this.firstPhysicalItemIndex % PHYSICAL_ITEMS;
                const firstItemTranslateY = ++this.physicalItems[normalizeFirstItemIndex].dataset.translateY;
                // const proximityToFirstPhysicalItem = this.scroller.scrollTop - firstItemTranslateY;

                const itemsSpace = this.lastPhysicalItemIndex - PHYSICAL_ITEMS + 1;
                const approximateEmptySpace = itemsSpace * (this.loadingItemHeight + 10);
                // console.log(approximateEmptySpace);
                // console.log('Appriximate to fist item: ', this.scroller.scrollTop - approximateEmptySpace);
                const proximityToFirstPhysicalItem = this.scroller.scrollTop - approximateEmptySpace;

                // console.log('Anchor Height: ', this.anchorItem.offsetHeight);
                // console.log('Scroller scrolltop: ', this.scroller.scrollTop);
                // console.log('Distance: ', this.scroller.scrollTop - this.anchorItem.offsetHeight);

                if (!this.requestInProgress && this.firstPhysicalItemIndex !== 0 && (proximityToFirstPhysicalItem < 300)) {
                    // console.log('First Item: ', this.firstPhysicalItemIndex);
                    // console.log('Last Item: ', this.lastPhysicalItemIndex);
                    // console.log('First item: ', this.physicalItems[normalizeFirstItemIndex]);
                    // console.log('Proximity to first Item: ', proximityToFirstPhysicalItem);

                    // could possibly check here instead for this.firstPhysicalItemIndex === 0
                    this.loadItemsUp();
                    // this.fill(this.anchorItem.index - RUNWAY_ITEMS_OPPOSITE, lastScreenItem.index + RUNWAY_ITEMS);
                }
            }
        }

        loadItems() {
            // if (this.count > 15) {
            //     return;
            // }

            this.requestInProgress = true;

            let loadingHeight = this.scrollRunwayEnd;

            // instead of appending 10 times, just append once
            // let addingElems = false;
            // const frag = document.createDocumentFragment();

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
                    // addingElems = true;
                    // frag.appendChild(loadingItem);
                    this.scroller.appendChild(loadingItem);
                }

                loadingHeight += this.loadingItemHeight + 10; // loadingHeight is more of loadingTranslateYValue
                // loadingHeight += this.loadingItemHeight + 10;
            }

            // instead of appending 10 times, just append once
            // if (addingElems) {
            //     this.scroller.appendChild(frag);
            // }

            // this.scrollRunway.style.transform = `translate(0,${this.loadingHeight}px)`;

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
            // console.log('Loading: ', this.loadingItems);

            const currentCacheDataLength = this.itemsCacheData.length;
            const nextIndexToPopulate = this.lastPhysicalItemIndex + 1;

            let itemTranslateY = 0;

            // if (fromCache) {
            //     const normalizeLastItemIndex = this.lastPhysicalItemIndex % PHYSICAL_ITEMS;
            //     const lastPhysicalItem = this.physicalItems[normalizeLastItemIndex];
            //     const lastPhysicalItemTranslateY = ++lastPhysicalItem.dataset.translateY;
            //     const lastPhysicalItemHeight = lastPhysicalItem.offsetHeight;
            //     itemTranslateY = lastPhysicalItemTranslateY + (lastPhysicalItemHeight + 10);
            // } else {
            //     itemTranslateY = this.scrollRunwayEnd;
            // }



            // const normalizeLastItemIndex = this.lastPhysicalItemIndex % PHYSICAL_ITEMS;
            // const lastPhysicalItem = this.physicalItems[normalizeLastItemIndex];
            // let lastPhysicalItemTranslateY = 0;
            // let lastPhysicalItemHeight = 0;

            // if (lastPhysicalItem) {
            //     lastPhysicalItemTranslateY = ++this.physicalItems[normalizeLastItemIndex].dataset.translateY;
            //     lastPhysicalItemHeight = this.physicalItems[normalizeLastItemIndex].offsetHeight;
            //     itemTranslateY = lastPhysicalItemTranslateY + (lastPhysicalItemHeight + 10);
            // }

            for (let i = 0; i < items.length; i += 1) {

                if (this.loadingItems[i]) {
                    this.loadingItems[i].classList.add('invisible');
                }

                const itemIndex = (nextIndexToPopulate + i) % PHYSICAL_ITEMS;

                // const hasItem = this.virtualItems[itemIndex] && this.virtualItems.length === PHYSICAL_ITEMS;
                const hasReusableItem = this.physicalItems[itemIndex] && this.physicalItems.length === PHYSICAL_ITEMS;

                const item = hasReusableItem ? this.dataSource.render(items[i], this.physicalItems[itemIndex]) : this.dataSource.render(items[i]);

                // Set the translateY value
                item.style.position = 'absolute';
                // item.style.transform = `translateY(${itemTranslateY}px)`;
                item.style.transform = `translateY(${this.lastPhysicalItemTranslateY}px)`;
                item.style.width = '92%';
                // We need these values to animate elements when removed
                // item.dataset.translateY = itemTranslateY;
                item.dataset.translateY = this.lastPhysicalItemTranslateY;

                if (!hasReusableItem) {
                    this.scroller.appendChild(item);
                }

                // We need to show right scrollbar size
                if (!fromCache) {
                    this.scrollRunwayEnd += item.offsetHeight + 10; // make 10 a constant
                }
                // itemTranslateY += item.offsetHeight + 10;
                this.lastPhysicalItemTranslateY += item.offsetHeight + 10;
                
                this.physicalItems[itemIndex] = item;
                // this.itemsCacheData.push(items[i]);
                this.itemsCacheData[currentCacheDataLength + i] = items[i];
            }
            
            // This uses the updated physicalItemIndex props
            this.calculatePhysicalItemsIndex(items.length);

            // Update runway translate to update scrollbar
            this.scrollRunway.style.transform = `translate(0,${this.scrollRunwayEnd}px)`;
            this.requestInProgress = false;
            this.count += 1;
        }

        loadItemsUp() {
            // if (this.firstPhysicalItemIndex === 0) {
            //     // we have reached the top
            //     return;
            // }

            this.requestInProgress = true;

            const normalizeFirstItemIndex = this.firstPhysicalItemIndex % PHYSICAL_ITEMS;
            let loadingItemTranslateY = ++this.physicalItems[normalizeFirstItemIndex].dataset.translateY - (this.loadingItemHeight + 10);

            // for (let i = 0; i < 10; i += 1) {
            for (let i = 9; i >= 0; i -= 1) {

                const hasLoadingItem = this.loadingItems[i];
                const loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();
                
                this.loadingItems[i] = loadingItem;

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

                loadingItemTranslateY -= (this.loadingItemHeight + 10);
            }

            this.populateItemsTop();
        }

        populateItemsTop() {

            const normalizeFirstItemIndex = this.firstPhysicalItemIndex % PHYSICAL_ITEMS;
            const firstPhysicalItemTranslateY = ++this.physicalItems[normalizeFirstItemIndex].dataset.translateY;
            const firstPhysicalItemHeight = this.physicalItems[normalizeFirstItemIndex].offsetHeight;
            const itemBeforeFirstPhysicalItemIndex = this.firstPhysicalItemIndex - 1;
            // const firstPhysicalItemIndex = this.firstPhysicalItemIndex;

            let itemTranslateY = firstPhysicalItemTranslateY - (firstPhysicalItemHeight + 10);
            // const firstItemIndex = Math.max(0, (this.firstAttachedItem - 10)) - 1;

            // looping backwards to grab the right data from cache, maybe look into looping forwards
            // for readability
            for (let i = itemBeforeFirstPhysicalItemIndex; i > itemBeforeFirstPhysicalItemIndex - 10; i -= 1) {
            // for (let i = (this.firstPhysicalItemIndex - 10); i < this.firstPhysicalItemIndex; i += 1) {

                if (this.loadingItems[i % 10]) {
                    this.loadingItems[i % 10].classList.add('invisible');
                }

                // revisit this logic
                // const reusableItemIndex = (this.lastPhysicalItemIndex - (PHYSICAL_ITEMS - 1 - i)) % PHYSICAL_ITEMS;
                // const reusableItemIndex = (this.firstPhysicalItemIndex - (10 - i)) % PHYSICAL_ITEMS;

                const reusableItemIndex = i % PHYSICAL_ITEMS;
                console.log('Reusbale last index: ', this.lastPhysicalItemIndex);
                console.log('Reusable index: ', reusableItemIndex);

                // const itemIndex = (this.lastAttachedItem - (10 - 1 - i)) % PHYSICAL_ITEMS;
                const hasItem = this.physicalItems[reusableItemIndex] && this.physicalItems.length === PHYSICAL_ITEMS;
                const item = hasItem ? this.dataSource.render(this.itemsCacheData[i], this.physicalItems[reusableItemIndex]) : this.dataSource.render(this.itemsCacheData[i]);

                item.style.position = 'absolute';
                // item.style.transform = `translateY(${itemTranslateY}px)`;
                item.style.transform = `translateY(${this.firstPhysicalItemTranslateY}px)`
                item.style.width = '92%';
                // We need these values to animate elements when removed
                // item.dataset.translateY = itemTranslateY;
                item.dataset.translateY = this.firstPhysicalItemTranslateY;

                // this should never go inside qhen scrolling up otherwise we messed up
                if (!hasItem) {
                    this.scroller.appendChild(item);
                }

                // itemTranslateY -= (item.offsetHeight + 10);
                this.firstPhysicalItemTranslateY -= (item.offsetHeight + 10);
                console.log('TranslateY: ', this.firstPhysicalItemTranslateY);
                
                this.physicalItems[reusableItemIndex] = item;
            }

            // Hmm will this work?
            this.calculatePhysicalItemsIndex(-10);

            // this.firstAttachedItem = index;
            // this.lastAttachedItem = this.firstAttachedItem + (10 - 1);

            this.requestInProgress = false;
        }

        calculatePhysicalItemsIndex(itemsLength) {

            this.lastPhysicalItemIndex += itemsLength;
            this.firstPhysicalItemIndex = Math.max(0, this.lastPhysicalItemIndex - (PHYSICAL_ITEMS - 1));
            this.middlePhysicalItemIndex = this.firstPhysicalItemIndex + ((this.lastPhysicalItemIndex - this.firstPhysicalItemIndex + 1) / 2);

            const lastPhysicalItem = this.physicalItems[this.lastPhysicalItemIndex % PHYSICAL_ITEMS];
            const firstPhysicalItem = this.physicalItems[this.firstPhysicalItemIndex % PHYSICAL_ITEMS];
            this.firstPhysicalItem = this.physicalItems[this.firstPhysicalItemIndex % PHYSICAL_ITEMS];
            this.lastPhysicalItem = this.physicalItems[this.lastPhysicalItemIndex % PHYSICAL_ITEMS];
            this.lastPhysicalItemTranslateY = parseInt(lastPhysicalItem.dataset.translateY, 10) + (lastPhysicalItem.offsetHeight + 10);
            this.firstPhysicalItemTranslateY = parseInt(firstPhysicalItem.dataset.translateY, 10) - (firstPhysicalItem.offsetHeight + 10);

            // Debug info
            // console.log('firstPhysicalItemIndex: ', this.firstPhysicalItemIndex);
            // console.log('middlePhysicalItemIndex: ', this.middlePhysicalItemIndex);
            // console.log('lastPhysicalItemIndex: ', this.lastPhysicalItemIndex);
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

            // this.target.style.transform = `translateX(${this.translateX}px)`;
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

                this.scroller.removeChild(this.target);
                // const targetIndex = this.items.indexOf(this.target);
                const targetIndex = this.virtualItems.indexOf(this.target);
                this.items.splice(targetIndex, 1);

                this.animateOtherItemsIntoPosition(targetIndex);

                // if (this.items.length < 6) {
                //     this.loadItems();
                // }

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
                // item.style.transform = '';
                // item.style.transform = `translateY(${parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10}px)`;
                // item.dataset.translateY

                this.resetTarget();
            };

            // Set up all card animations
            for (let i = startIndex; i < this.virtualItems.length; i += 1) {
                const item = this.virtualItems[i];

                // Move the card down then slide it up.
                // item.style.transform = `translateY(${this.targetBCR.height + 10}px)`;
                item.style.transform = `translateY(${item.dataset.translateY}px)`;
                item.addEventListener('transitionend', (e) => onAnimationComplete(e));
            }

            // Now init them
            requestAnimationFrame(_ => {
                for (let i = startIndex; i < this.virtualItems.length; i += 1) {
                    const item = this.virtualItems[i];

                    // Move the card down then slide it up, with delay according to "distance"
                    // item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1) ${i*50}ms`;
                    item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1)`;
                    // item.style.transform = '';
                    console.log('targetBCRheight: ', this.targetBCR.height);
                    item.style.transform = `translateY(${parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10}px)`;
                    item.dataset.translateY = parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10;
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