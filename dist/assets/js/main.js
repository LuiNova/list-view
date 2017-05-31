'use strict';

// For any third party dependencies, like jQuery, place them in the lib folder.

// Configure loading modules from the lib directory,
// except for 'app' ones, which are in a sibling
// directory.
requirejs.config({
    baseUrl: 'src/javascript',
    paths: {
        app: '../dist'
    }
});

// Start loading the main app file. Put all of
// your application logic in there.
requirejs(['main'], function (main) {
    main.init();
});
'use strict';

define('main', ['components/infinite-scroller', 'components/infinite-scroller-experimental', 'datasource/messages'], function (InfiniteScroller, InfiniteScrollerExperimental, Messages) {
    'use strict';

    return {
        init: function init() {
            var scroller = document.querySelector('#messages');
            var scrollerExp = document.querySelector('#messages-exp');
            var messagesSource = new Messages({
                url: 'https://message-list.appspot.com',
                dataEndpoint: '/messages'
            });

            if (scroller) {
                this.infiniteScroller = new InfiniteScroller(scroller, messagesSource, {
                    swipeable: true
                });
            }

            if (scrollerExp) {
                this.infiniteScrollerExp = new InfiniteScrollerExperimental(scrollerExp, messagesSource, {
                    swipeable: true
                });
            }
        }
    };
});
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define('components/infinite-scroller-experimental', [], function () {
    'use strict';

    var PHYSICAL_ITEMS = 20;
    var PAGE_SIZE = 10;
    var PROXIMITY_BOUNDARY = 300;

    var InfiniteScroller = function () {
        function InfiniteScroller(scroller, dataSource, options) {
            _classCallCheck(this, InfiniteScroller);

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

        _createClass(InfiniteScroller, [{
            key: 'addEventListeners',
            value: function addEventListeners() {
                var _this = this;

                window.addEventListener('resize', function (e) {
                    return _this.onResize(e);
                });

                this.scroller.addEventListener('scroll', function (e) {
                    return _this.onScroll(e);
                });

                if (this.swipeable) {
                    this.scroller.addEventListener('touchstart', function (e) {
                        return _this.onTouchStart(e);
                    });
                    this.scroller.addEventListener('touchmove', function (e) {
                        return _this.onTouchMove(e);
                    });
                    this.scroller.addEventListener('touchend', function (e) {
                        return _this.onTouchEnd(e);
                    });
                }
            }
        }, {
            key: 'onResize',
            value: function onResize(e) {
                // On resize need to recalculate the translateY values for the elements
                var loadingItem = this.dataSource.createLoadingElement();
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

        }, {
            key: 'onScroll',
            value: function onScroll(e) {
                if (this.requestInProgress) {
                    return;
                }

                var delta = this.scroller.scrollTop - this.previousScrollTop;
                this.previousScrollTop = this.scroller.scrollTop;

                /**
                 * if delta is greater than 0 then user is scrolling down
                 */
                if (delta > 0) {
                    var actualLastPhysicalItemTranslateY = this.lastPhysicalItemTranslateY - (this.lastPhysicalItem.offsetHeight + 10);
                    var proximityToLastPhysicalItem = actualLastPhysicalItemTranslateY - (this.scroller.scrollTop + this.scroller.offsetHeight);

                    if (!this.requestInProgress && proximityToLastPhysicalItem < this.PROXIMITY_BOUNDARY) {
                        this.loadItems();
                    }
                } else if (delta < 0) {
                    var proximityToFirstPhysicalItem = this.scroller.scrollTop - this.firstPhysicalItemTranslateY;

                    if (!this.requestInProgress && this.firstPhysicalItemIndex !== 0 && proximityToFirstPhysicalItem < this.PROXIMITY_BOUNDARY) {
                        this.loadItemsUp();
                    }
                }
            }
        }, {
            key: 'loadItems',
            value: function loadItems() {
                var _this2 = this;

                this.requestInProgress = true;

                var loadingHeight = this.lastPhysicalItemTranslateY;

                // instead of appending 10 times, just append once
                // let addingElems = false;
                // const frag = document.createDocumentFragment();

                // Loading items
                for (var i = 0; i < this.PAGE_SIZE; i += 1) {
                    var hasLoadingItem = this.loadingItems[i];
                    var loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();

                    loadingItem.style.position = 'absolute';
                    loadingItem.style.transform = 'translateY(' + loadingHeight + 'px)';
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

                var nextIndexToPopulate = this.lastPhysicalItemIndex + 1;
                // Check the cache
                if (this.itemsCacheData[nextIndexToPopulate]) {
                    // use cache to populate items
                    this.populateItems(this.itemsCacheData.slice(nextIndexToPopulate, nextIndexToPopulate + 10), true);
                } else {
                    // 10 items
                    this.dataSource.next().then(function (response) {
                        _this2.populateItems(response, false);
                    });
                }
            }
        }, {
            key: 'populateItems',
            value: function populateItems(items, fromCache) {
                var currentCacheDataLength = this.itemsCacheData.length;
                var nextIndexToPopulate = this.lastPhysicalItemIndex + 1;

                // let itemTranslateY = 0;
                var itemTranslateY = this.lastPhysicalItemTranslateY;

                for (var i = 0; i < items.length; i += 1) {

                    if (this.loadingItems[i]) {
                        this.loadingItems[i].classList.add('invisible');
                    }

                    var itemIndex = (nextIndexToPopulate + i) % this.PHYSICAL_ITEMS;
                    var hasReusableItem = this.physicalItems[itemIndex];
                    var item = hasReusableItem ? this.dataSource.render(items[i], this.physicalItems[itemIndex]) : this.dataSource.render(items[i]);

                    item.style.position = 'absolute';
                    item.style.transform = 'translateY(' + itemTranslateY + 'px)';
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
                this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';
                this.requestInProgress = false;
            }
        }, {
            key: 'loadItemsUp',
            value: function loadItemsUp() {
                this.requestInProgress = true;

                var loadingItemTranslateY = this.firstPhysicalItemTranslateY;

                for (var i = 9; i >= 0; i -= 1) {

                    var hasLoadingItem = this.loadingItems[i];
                    var loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();

                    loadingItem.style.position = 'absolute';
                    loadingItem.style.transform = 'translateY(' + loadingItemTranslateY + 'px)';
                    loadingItem.style.width = '92%';
                    loadingItem.classList.remove('invisible');

                    // If loading item not in DOM then add it
                    if (!hasLoadingItem) {
                        // addingElems = true;
                        // frag.appendChild(loadingItem);
                        this.scroller.appendChild(loadingItem);
                    }

                    this.loadingItems[i] = loadingItem;

                    loadingItemTranslateY -= this.loadingItemHeight + 10;
                }

                this.populateItemsTop();
            }
        }, {
            key: 'populateItemsTop',
            value: function populateItemsTop() {

                var itemBeforeFirstPhysicalItemIndex = this.firstPhysicalItemIndex - 1;

                var itemTranslateY = this.firstPhysicalItemTranslateY;

                for (var i = itemBeforeFirstPhysicalItemIndex; i > itemBeforeFirstPhysicalItemIndex - 10; i -= 1) {

                    if (this.loadingItems[i % 10]) {
                        this.loadingItems[i % 10].classList.add('invisible');
                    }

                    var reusableItemIndex = i % this.PHYSICAL_ITEMS;
                    var hasItem = this.physicalItems[reusableItemIndex];
                    var item = hasItem ? this.dataSource.render(this.itemsCacheData[i], this.physicalItems[reusableItemIndex]) : this.dataSource.render(this.itemsCacheData[i]);

                    item.style.position = 'absolute';
                    item.style.transform = 'translateY(' + itemTranslateY + 'px)';
                    // We need these values to animate elements when removed
                    item.dataset.translateY = itemTranslateY;
                    item.style.width = '92%';

                    // this should never go inside when scrolling up otherwise we messed up
                    if (!hasItem) {
                        this.scroller.appendChild(item);
                    }

                    itemTranslateY -= item.offsetHeight + 10;

                    this.physicalItems[reusableItemIndex] = item;
                }

                this.calculatePhysicalItemsIndex(-10);
                this.requestInProgress = false;
            }
        }, {
            key: 'calculatePhysicalItemsIndex',
            value: function calculatePhysicalItemsIndex(itemsLength) {

                this.lastPhysicalItemIndex += itemsLength;
                this.firstPhysicalItemIndex = Math.max(0, this.lastPhysicalItemIndex - (this.PHYSICAL_ITEMS - 1));
                this.middlePhysicalItemIndex = this.firstPhysicalItemIndex + (this.lastPhysicalItemIndex - this.firstPhysicalItemIndex + 1) / 2;

                this.firstPhysicalItem = this.physicalItems[this.firstPhysicalItemIndex % this.PHYSICAL_ITEMS];
                this.lastPhysicalItem = this.physicalItems[this.lastPhysicalItemIndex % this.PHYSICAL_ITEMS];

                // this is used for the next
                this.firstPhysicalItemTranslateY = parseInt(this.firstPhysicalItem.dataset.translateY, 10) - (this.firstPhysicalItem.offsetHeight + 10);
                this.lastPhysicalItemTranslateY = parseInt(this.lastPhysicalItem.dataset.translateY, 10) + (this.lastPhysicalItem.offsetHeight + 10);
            }
        }, {
            key: 'onTouchStart',
            value: function onTouchStart(e) {
                var _this3 = this;

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

                requestAnimationFrame(function () {
                    return _this3.update();
                });

                // e.preventDefault();
            }
        }, {
            key: 'onTouchMove',
            value: function onTouchMove(e) {
                if (!this.target) {
                    return;
                }

                this.currentX = e.touches[0].pageX;
            }
        }, {
            key: 'onTouchEnd',
            value: function onTouchEnd(e) {
                if (!this.target) {
                    return;
                }

                this.targetX = 0;
                var translateX = this.currentX - this.startX;
                var threshold = this.targetBCR.width * 0.35;

                if (Math.abs(translateX) > threshold) {
                    this.targetX = translateX > 0 ? this.targetBCR.width : -this.targetBCR.width;
                }

                this.draggingItem = false;
            }
        }, {
            key: 'update',
            value: function update() {
                var _this4 = this;

                requestAnimationFrame(function () {
                    return _this4.update();
                });

                if (!this.target) {
                    return;
                }

                if (this.draggingItem) {
                    this.translateX = this.currentX - this.startX;
                } else {
                    this.translateX += (this.targetX - this.translateX) / 4;
                }

                var normalizedDragDistance = Math.abs(this.translateX) / this.targetBCR.width;
                var opacity = 1 - Math.pow(normalizedDragDistance, 3);

                // Since we are manipulating elements through translates we need to keep translateY
                this.target.style.transform = 'translate(' + this.translateX + 'px, ' + this.target.dataset.translateY + 'px)';
                this.target.style.opacity = opacity;

                // User has not finished dragging
                if (this.draggingItem) {
                    return;
                }

                var isNearlyAtStart = Math.abs(this.translateX) < 0.01;
                var isNearlyInvisible = opacity < 0.01;

                if (isNearlyInvisible) {

                    if (!this.target || !this.target.parentNode) {
                        return;
                    }

                    this.scrollRunwayEnd -= this.target.offsetHeight + 10;
                    this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';

                    var targetTranslateY = this.target.dataset.translateY;
                    this.scroller.removeChild(this.target);
                    var targetIndex = this.physicalItems.indexOf(this.target);
                    var targetDataIndex = parseInt(this.target.dataset.id, 10);
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
        }, {
            key: 'animateOtherItemsIntoPosition',
            value: function animateOtherItemsIntoPosition(startIndex, translateY) {
                var _this5 = this;

                // If removed card was the last one, there is nothing to animate.
                // Remove the target
                if (startIndex === this.physicalItems.length) {
                    this.resetTarget();
                    return;
                }

                var onAnimationComplete = function onAnimationComplete(e) {
                    var item = e.target;
                    item.removeEventListener('transitionend', onAnimationComplete);
                    item.style.transition = '';
                    // item.style.transform = '';
                    // item.style.transform = `translateY(${parseInt(item.dataset.translateY, 10) - this.targetBCR.height - 10}px)`;
                    // item.dataset.translateY

                    _this5.resetTarget();
                };

                // Set up all card animations
                for (var i = 0; i < this.physicalItems.length; i += 1) {
                    var item = this.physicalItems[i];

                    if (item.dataset.translateY > translateY) {
                        // Move the card down then slide it up.
                        // item.style.transform = `translateY(${this.targetBCR.height + 10}px)`;
                        item.style.transform = 'translateY(' + item.dataset.translateY + 'px)';
                        item.addEventListener('transitionend', function (e) {
                            return onAnimationComplete(e);
                        });
                    }
                }

                // Now init them
                requestAnimationFrame(function (_) {
                    for (var _i = 0; _i < _this5.physicalItems.length; _i += 1) {
                        var _item = _this5.physicalItems[_i];

                        if (_item.dataset.translateY > translateY) {
                            _item.style.transition = 'transform 150ms cubic-bezier(0,0,0.31,1)';
                            _item.style.transform = 'translateY(' + (parseInt(_item.dataset.translateY, 10) - _this5.targetBCR.height - 10) + 'px)';
                            _item.dataset.translateY = parseInt(_item.dataset.translateY, 10) - _this5.targetBCR.height - 10;
                        }
                    }
                });
            }
        }, {
            key: 'resetTarget',
            value: function resetTarget() {
                if (!this.target) {
                    return;
                }

                this.target.style.willChange = 'initial';
                // this.target.style.transform = 'none';
                this.target.style.transform = 'translateY(' + this.target.dataset.translateY + 'px)';
                this.target = null;
            }
        }]);

        return InfiniteScroller;
    }();

    return InfiniteScroller;
});
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define('components/infinite-scroller-v2', [], function () {
    'use strict';

    var RUNWAY_ITEMS = 50;
    var RUNWAY_ITEMS_OPPOSITE = 10;
    var SCROLL_RUNWAY = 2000;
    var ANIMATION_DURATION_MS = 200;

    var InfiniteScroller = function () {
        function InfiniteScroller(scroller, dataSource, options) {
            _classCallCheck(this, InfiniteScroller);

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

        _createClass(InfiniteScroller, [{
            key: 'addEventListeners',
            value: function addEventListeners() {
                var _this = this;

                window.addEventListener('resize', function (e) {
                    return _this.onResize(e);
                });
                this.scroller.addEventListener('scroll', function (e) {
                    return _this.onScroll(e);
                });

                if (this.swipeable) {
                    this.scroller.addEventListener('touchstart', function (e) {
                        return _this.onTouchStart(e);
                    });
                    this.scroller.addEventListener('touchmove', function (e) {
                        return _this.onTouchMove(e);
                    });
                    this.scroller.addEventListener('touchend', function (e) {
                        return _this.onTouchEnd(e);
                    });
                }
            }
        }, {
            key: 'loadItems',
            value: function loadItems() {
                var _this2 = this;

                this.requestInProgress = true;

                // loaidng items
                for (var i = 0; i < 10; i += 1) {
                    var loadingItem = this.dataSource.createLoadingElement();
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
                this.dataSource.next().then(function (response) {
                    _this2.populateItems(response);
                    return _this2.dataSource.next();
                });
            }
        }, {
            key: 'loadItemsExp',
            value: function loadItemsExp(firstLoad) {
                var _this3 = this;

                if (this.count > 15) {
                    return;
                }

                this.requestInProgress = true;
                var loadingHeight = this.scrollRunwayEnd;

                // loaidng items
                for (var i = 0; i < 10; i += 1) {
                    var hasLoadingItem = this.loadingItems[i];
                    var loadingItem = hasLoadingItem ? this.loadingItems[i] : this.dataSource.createLoadingElement();

                    this.loadingItems[i] = loadingItem;

                    // Experimental - Transform instead of removing elements
                    loadingItem.style.position = 'absolute';
                    loadingItem.style.transform = 'translateY(' + loadingHeight + 'px)';
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
                    var firstLoadItems = [];
                    this.dataSource.next().then(function (response) {
                        firstLoadItems = firstLoadItems.concat(response);
                        return _this3.dataSource.next();
                    }).then(function (response) {
                        firstLoadItems = firstLoadItems.concat(response);
                        _this3.populateItemsExp(firstLoadItems);
                    });
                } else {
                    // 10 items
                    this.dataSource.next().then(function (response) {
                        _this3.populateItemsExp(response);
                        // return this.dataSource.next();
                    });
                }
            }
        }, {
            key: 'populateItems',
            value: function populateItems(items) {
                // console.log('Loading: ', this.loadingItems);

                for (var i = 0; i < items.length; i += 1) {

                    if (this.loadingItems[0]) {
                        this.scroller.removeChild(this.loadingItems[0]);
                        this.loadingItems.splice(0, 1);
                    }
                    var item = this.dataSource.render(items[i]);
                    this.scroller.appendChild(item);

                    this.scrollRunwayEnd += item.offsetHeight + 10;
                    this.items.push(item);
                }

                this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';
                this.requestInProgress = false;
            }
        }, {
            key: 'populateItemsExp',
            value: function populateItemsExp(items) {
                console.log('Hello');
                // console.log('Loading: ', this.loadingItems);

                for (var i = 0; i < items.length; i += 1) {

                    if (this.loadingItems[i]) {
                        this.loadingItems[i].classList.add('invisible');
                    }

                    var itemIndex = (this.firstAttachedItem + i) % 20;
                    var hasItem = this.virtualItems[itemIndex] && this.virtualItems.length === 20;

                    var item = hasItem ? this.dataSource.render(items[i], this.virtualItems[itemIndex]) : this.dataSource.render(items[i]);

                    // Experimental - Transform instead of removing elements
                    item.style.position = 'absolute';
                    item.style.transform = 'translateY(' + this.scrollRunwayEnd + 'px)';
                    item.style.width = '92%';

                    if (!hasItem) {
                        this.scroller.appendChild(item);
                    }

                    this.scrollRunwayEnd += item.offsetHeight + 10;

                    this.virtualItems[itemIndex] = item;
                    this.items.push(item);
                }

                this.lastAttachedItem = this.firstAttachedItem + (items.length - 1);

                this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';
                this.requestInProgress = false;
                this.count += 1;
            }
        }, {
            key: 'onResize',
            value: function onResize(e) {
                var loadingItem = this.dataSource.createLoadingElement();
                this.scroller.appendChild(loadingItem);
                this.loadingItemHeight = loadingItem.offsetHeight;
                this.loadingItemWidth = loadingItem.offsetWidth;
                this.scroller.removeChild(loadingItem);

                // Reset cahced size of items in the scroller
                for (var i = 0; i < this.items.length; i += 1) {
                    this.items[i].height = this.items[i].width = 0;
                }

                this.onScroll();
            }

            /**
             * It then updates the visible
             * elements, requesting more items from the dataSource if we have scrolled
             * past the end of currently available content.
             */

        }, {
            key: 'onScroll',
            value: function onScroll(e) {
                var delta = this.scroller.scrollTop - this.previousScrollTop;
                this.previousScrollTop = this.scroller.scrollTop;

                if (delta > 0) {
                    // scrolling down
                    var scrollBoundary = this.scroller.scrollTop + this.scroller.offsetHeight + 200;

                    if (!this.requestInProgress && scrollBoundary > this.scroller.scrollHeight) {
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

        }, {
            key: 'fill',
            value: function fill(start, end) {
                this.firstAttachedItem = Math.max(0, start);
                this.lastAttachedItem = end;
                this.attachContent();
            }
        }, {
            key: 'getLoadingItem',
            value: function getLoadingItem() {
                var loadingItem = this.loadingItems.pop();
                if (loadingItem) {
                    return loadingItem;
                }

                return this.dataSource.createLoadingElement();
            }
        }, {
            key: 'attachContent',
            value: function attachContent(start, end) {
                // here some logic to go fetch items i.e. scrolling down and not more virtualItems
                // and just loading from virtual items

            }
        }, {
            key: 'addItem',
            value: function addItem() {
                this.items.push({
                    data: null,
                    node: null
                });
            }
        }, {
            key: 'addContent',
            value: function addContent(items) {
                this.requestInProgress = false;
                for (var i = 0; i < items.length; i += 1) {
                    this.addItem();
                    this.items[this.loadedItems++].data = items[i];
                }
                this.attachContent();
            }
        }, {
            key: 'onTouchStart',
            value: function onTouchStart(e) {
                var _this4 = this;

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

                requestAnimationFrame(function () {
                    return _this4.update();
                });

                // e.preventDefault();
            }
        }, {
            key: 'onTouchMove',
            value: function onTouchMove(e) {
                if (!this.target) {
                    return;
                }

                this.currentX = e.touches[0].pageX;
            }
        }, {
            key: 'onTouchEnd',
            value: function onTouchEnd(e) {
                if (!this.target) {
                    return;
                }

                this.targetX = 0;
                var translateX = this.currentX - this.startX;
                var threshold = this.targetBCR.width * 0.35;

                if (Math.abs(translateX) > threshold) {
                    this.targetX = translateX > 0 ? this.targetBCR.width : -this.targetBCR.width;
                }

                this.draggingItem = false;
            }
        }, {
            key: 'update',
            value: function update() {
                var _this5 = this;

                requestAnimationFrame(function () {
                    return _this5.update();
                });

                if (!this.target) {
                    return;
                }

                if (this.draggingItem) {
                    this.translateX = this.currentX - this.startX;
                } else {
                    this.translateX += (this.targetX - this.translateX) / 4;
                }

                var normalizedDragDistance = Math.abs(this.translateX) / this.targetBCR.width;
                var opacity = 1 - Math.pow(normalizedDragDistance, 3);

                this.target.style.transform = 'translateX(' + this.translateX + 'px)';
                this.target.style.opacity = opacity;

                // User has not finished dragging
                if (this.draggingItem) {
                    return;
                }

                var isNearlyAtStart = Math.abs(this.translateX) < 0.01;
                var isNearlyInvisible = opacity < 0.01;

                if (isNearlyInvisible) {

                    if (!this.target || !this.target.parentNode) {
                        return;
                    }

                    this.scrollRunwayEnd -= this.target.offsetHeight + 10;
                    this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';

                    this.scroller.removeChild(this.target);
                    var targetIndex = this.items.indexOf(this.target);
                    this.items.splice(targetIndex, 1);

                    this.animateOtherItemsIntoPosition(targetIndex);

                    if (this.items.length < 6) {
                        this.loadItems();
                    }
                } else if (isNearlyAtStart) {
                    this.resetTarget();
                }
            }
        }, {
            key: 'animateOtherItemsIntoPosition',
            value: function animateOtherItemsIntoPosition(startIndex) {
                var _this6 = this;

                // If removed card was the last one, there is nothing to animate.
                // Remove the target
                if (startIndex === this.items.length) {
                    this.resetTarget();
                    return;
                }

                var onAnimationComplete = function onAnimationComplete(e) {
                    var item = e.target;
                    item.removeEventListener('transitionend', onAnimationComplete);
                    item.style.transition = '';
                    item.style.transform = '';

                    _this6.resetTarget();
                };

                // Set up all card animations
                for (var i = startIndex; i < this.items.length; i += 1) {
                    var item = this.items[i];

                    // Move the card down then slide it up.
                    item.style.transform = 'translateY(' + (this.targetBCR.height + 10) + 'px)';
                    item.addEventListener('transitionend', function (e) {
                        return onAnimationComplete(e);
                    });
                }

                // Now init them
                requestAnimationFrame(function (_) {
                    for (var _i = startIndex; _i < _this6.items.length; _i += 1) {
                        var _item = _this6.items[_i];

                        // Move the card down then slide it up, with delay according to "distance"
                        // item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1) ${i*50}ms`;
                        _item.style.transition = 'transform 150ms cubic-bezier(0,0,0.31,1)';
                        _item.style.transform = '';
                    }
                });
            }
        }, {
            key: 'resetTarget',
            value: function resetTarget() {
                if (!this.target) {
                    return;
                }

                this.target.style.willChange = 'initial';
                this.target.style.transform = 'none';
                this.target = null;
            }
        }]);

        return InfiniteScroller;
    }();

    return InfiniteScroller;
});
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define('components/infinite-scroller', [], function () {
    'use strict';

    var RUNWAY_ITEMS = 50;
    var RUNWAY_ITEMS_OPPOSITE = 10;
    var SCROLL_RUNWAY = 2000;
    var ANIMATION_DURATION_MS = 200;
    var PHYSICAL_ITEMS = 20;

    var InfiniteScroller = function () {
        function InfiniteScroller(scroller, dataSource, options) {
            _classCallCheck(this, InfiniteScroller);

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
            this.itemsData = [];
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
            this.anchorItem.style.height = '0px';
            this.anchorItem.style.width = '1px';
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
            this.loadItems();
        }

        _createClass(InfiniteScroller, [{
            key: 'addEventListeners',
            value: function addEventListeners() {
                var _this = this;

                window.addEventListener('resize', function (e) {
                    return _this.onResize(e);
                });
                this.scroller.addEventListener('scroll', function (e) {
                    return _this.onScroll(e);
                });

                if (this.swipeable) {
                    this.scroller.addEventListener('touchstart', function (e) {
                        return _this.onTouchStart(e);
                    });
                    this.scroller.addEventListener('touchmove', function (e) {
                        return _this.onTouchMove(e);
                    });
                    this.scroller.addEventListener('touchend', function (e) {
                        return _this.onTouchEnd(e);
                    });
                }
            }
        }, {
            key: 'loadItems',
            value: function loadItems() {
                var _this2 = this;

                if (this.count > 15) {
                    return;
                }

                this.requestInProgress = true;

                // loaidng items
                for (var i = 0; i < 10; i += 1) {
                    var loadingItem = this.dataSource.createLoadingElement();
                    this.loadingItems[i] = loadingItem;
                    this.scroller.appendChild(loadingItem);
                }

                // 10 items
                this.dataSource.next().then(function (response) {
                    _this2.populateItems(response);
                });
            }
        }, {
            key: 'populateItems',
            value: function populateItems(items) {
                // console.log('Loading: ', this.loadingItems);

                for (var i = 0; i < items.length; i += 1) {

                    if (this.loadingItems[0]) {
                        this.scroller.removeChild(this.loadingItems[0]);
                        this.loadingItems.splice(0, 1);
                    }
                    var item = this.dataSource.render(items[i]);
                    this.scroller.appendChild(item);

                    this.scrollRunwayEnd += item.offsetHeight + 10;
                    this.items.push(item);
                }

                this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';
                this.requestInProgress = false;
                this.count += 1;
            }
        }, {
            key: 'onResize',
            value: function onResize(e) {
                var loadingItem = this.dataSource.createLoadingElement();
                this.scroller.appendChild(loadingItem);
                this.loadingItemHeight = loadingItem.offsetHeight;
                this.loadingItemWidth = loadingItem.offsetWidth;
                this.scroller.removeChild(loadingItem);

                // Reset cahced size of items in the scroller
                for (var i = 0; i < this.items.length; i += 1) {
                    this.items[i].height = this.items[i].width = 0;
                }

                this.onScroll();
            }

            /**
             * It then updates the visible
             * elements, requesting more items from the dataSource if we have scrolled
             * past the end of currently available content.
             */

        }, {
            key: 'onScroll',
            value: function onScroll(e) {
                var delta = this.scroller.scrollTop - this.previousScrollTop;
                this.previousScrollTop = this.scroller.scrollTop;

                if (delta > 0) {
                    // scrolling down
                    var scrollBoundary = this.scroller.scrollTop + this.scroller.offsetHeight + 200;

                    if (!this.requestInProgress && scrollBoundary > this.scroller.scrollHeight) {
                        // this.loadItems();

                        this.firstAttachedItem = this.lastAttachedItem + 1;

                        this.loadItems();
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

        }, {
            key: 'fill',
            value: function fill(start, end) {
                this.firstAttachedItem = Math.max(0, start);
                this.lastAttachedItem = end;
                this.attachContent();
            }
        }, {
            key: 'getLoadingItem',
            value: function getLoadingItem() {
                var loadingItem = this.loadingItems.pop();
                if (loadingItem) {
                    return loadingItem;
                }

                return this.dataSource.createLoadingElement();
            }
        }, {
            key: 'attachContent',
            value: function attachContent(start, end) {
                // here some logic to go fetch items i.e. scrolling down and not more virtualItems
                // and just loading from virtual items

            }
        }, {
            key: 'addItem',
            value: function addItem() {
                this.items.push({
                    data: null,
                    node: null
                });
            }
        }, {
            key: 'addContent',
            value: function addContent(items) {
                this.requestInProgress = false;
                for (var i = 0; i < items.length; i += 1) {
                    this.addItem();
                    this.items[this.loadedItems++].data = items[i];
                }
                this.attachContent();
            }
        }, {
            key: 'onTouchStart',
            value: function onTouchStart(e) {
                var _this3 = this;

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

                requestAnimationFrame(function () {
                    return _this3.update();
                });

                // e.preventDefault();
            }
        }, {
            key: 'onTouchMove',
            value: function onTouchMove(e) {
                if (!this.target) {
                    return;
                }

                this.currentX = e.touches[0].pageX;
            }
        }, {
            key: 'onTouchEnd',
            value: function onTouchEnd(e) {
                if (!this.target) {
                    return;
                }

                this.targetX = 0;
                var translateX = this.currentX - this.startX;
                var threshold = this.targetBCR.width * 0.35;

                if (Math.abs(translateX) > threshold) {
                    this.targetX = translateX > 0 ? this.targetBCR.width : -this.targetBCR.width;
                }

                this.draggingItem = false;
            }
        }, {
            key: 'update',
            value: function update() {
                var _this4 = this;

                requestAnimationFrame(function () {
                    return _this4.update();
                });

                if (!this.target) {
                    return;
                }

                if (this.draggingItem) {
                    this.translateX = this.currentX - this.startX;
                } else {
                    this.translateX += (this.targetX - this.translateX) / 4;
                }

                var normalizedDragDistance = Math.abs(this.translateX) / this.targetBCR.width;
                var opacity = 1 - Math.pow(normalizedDragDistance, 3);

                this.target.style.transform = 'translateX(' + this.translateX + 'px)';
                this.target.style.opacity = opacity;

                // User has not finished dragging
                if (this.draggingItem) {
                    return;
                }

                var isNearlyAtStart = Math.abs(this.translateX) < 0.01;
                var isNearlyInvisible = opacity < 0.01;

                if (isNearlyInvisible) {

                    if (!this.target || !this.target.parentNode) {
                        return;
                    }

                    // Update runway (i.e. update scrollbar)
                    this.scrollRunwayEnd -= this.target.offsetHeight + 10;
                    this.scrollRunway.style.transform = 'translate(0,' + this.scrollRunwayEnd + 'px)';

                    this.scroller.removeChild(this.target);
                    var targetIndex = this.items.indexOf(this.target);
                    this.items.splice(targetIndex, 1);

                    this.animateOtherItemsIntoPosition(targetIndex);

                    if (this.items.length < 6) {
                        this.loadItems();
                    }
                } else if (isNearlyAtStart) {
                    this.resetTarget();
                }
            }
        }, {
            key: 'animateOtherItemsIntoPosition',
            value: function animateOtherItemsIntoPosition(startIndex) {
                var _this5 = this;

                // If removed card was the last one, there is nothing to animate.
                // Remove the target
                if (startIndex === this.items.length) {
                    this.resetTarget();
                    return;
                }

                var onAnimationComplete = function onAnimationComplete(e) {
                    var item = e.target;
                    item.removeEventListener('transitionend', onAnimationComplete);
                    item.style.transition = '';
                    item.style.transform = '';

                    _this5.resetTarget();
                };

                // Set up all card animations
                for (var i = startIndex; i < this.items.length; i += 1) {
                    var item = this.items[i];

                    // Move the card down then slide it up.
                    item.style.transform = 'translateY(' + (this.targetBCR.height + 10) + 'px)';
                    item.addEventListener('transitionend', function (e) {
                        return onAnimationComplete(e);
                    });
                }

                // Now init them
                requestAnimationFrame(function (_) {
                    for (var _i = startIndex; _i < _this5.items.length; _i += 1) {
                        var _item = _this5.items[_i];

                        // Move the card down then slide it up, with delay according to "distance"
                        // item.style.transition = `transform 150ms cubic-bezier(0,0,0.31,1) ${i*50}ms`;
                        _item.style.transition = 'transform 150ms cubic-bezier(0,0,0.31,1)';
                        _item.style.transform = '';
                    }
                });
            }
        }, {
            key: 'resetTarget',
            value: function resetTarget() {
                if (!this.target) {
                    return;
                }

                this.target.style.willChange = 'initial';
                this.target.style.transform = 'none';
                this.target = null;
            }
        }]);

        return InfiniteScroller;
    }();

    return InfiniteScroller;
});
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

define('datasource/messages', [], function () {
    'use strict';

    var Messages = function () {
        function Messages(options) {
            _classCallCheck(this, Messages);

            this.loadingTemplate = document.querySelector('#templates .scroller__item--loading');
            this.messageTemplate = document.querySelector('#templates .scroller__item');

            this.url = options.url;
            this.dataEndpoint = options.dataEndpoint;
            this.dataUrl = '' + this.url + this.dataEndpoint;

            this.nextItem = 0;

            this.nextPageToken = null;
        }

        /**
         * Fetch items from datasource.
         */


        _createClass(Messages, [{
            key: 'fetch',
            value: function fetch(obj) {
                return new Promise(function (resolve, reject) {

                    var params = obj.params;
                    if (params && (typeof params === 'undefined' ? 'undefined' : _typeof(params)) === 'object') {
                        params = Object.keys(params).map(function (key) {
                            return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                        }).join('&');
                    }

                    var url = params ? obj.url + '?' + params : obj.url;

                    var xhr = new XMLHttpRequest();
                    xhr.open(obj.method || 'GET', url);

                    xhr.onload = function () {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(xhr.response);
                        } else {
                            reject(xhr.statusText);
                        }
                    };

                    xhr.onerror = function () {
                        reject(xhr.statusText);
                    };

                    // let params = obj.params;
                    // if (params && typeof params === 'object') {
                    //     params = Object.keys(params).map((key) => {
                    //         return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                    //     }).join('&');
                    // }
                    xhr.send();
                });
            }
        }, {
            key: 'next',
            value: function next() {
                var _this = this;

                var options = {
                    method: 'GET',
                    url: this.dataUrl
                };

                if (this.nextPageToken) {
                    options.params = {
                        pageToken: this.nextPageToken
                    };
                    // Object.assign(options, {
                    //     params: {
                    //         pageToken: this.nextPageToken
                    //     }
                    // });
                }

                return this.fetch(options).then(function (response) {
                    var jsonResponse = JSON.parse(response);
                    _this.nextPageToken = jsonResponse.pageToken;
                    return jsonResponse.messages;
                });

                // return this.fetch(options);
            }

            /**
             * Create a loading element, all loading elements are identical
             */

        }, {
            key: 'createLoadingElement',
            value: function createLoadingElement() {
                return this.loadingTemplate.cloneNode(true);
            }

            /**
             * Render an item, reusing the provided div if provided
             */

        }, {
            key: 'render',
            value: function render(item, div) {
                div = div || this.messageTemplate.cloneNode(true);

                div.dataset.id = item.id;

                div.querySelector('.card__avatar').src = '' + this.url + item.author.photoUrl;
                div.querySelector('.card__title').textContent = item.author.name;
                div.querySelector('.card__subtitle').textContent = this.timeSince(new Date(item.updated)); //item.updated.toString();
                div.querySelector('.card__content').textContent = item.content;

                return div;
            }
        }, {
            key: 'timeSince',
            value: function timeSince(date) {
                if ((typeof date === 'undefined' ? 'undefined' : _typeof(date)) !== 'object') {
                    date = new Date(date);
                }

                var seconds = Math.floor((new Date() - date) / 1000),
                    interval = Math.floor(seconds / 31536000);

                if (interval >= 1) {
                    return interval + ' year' + (interval > 1 ? 's' : '') + ' ago';
                }

                interval = Math.floor(seconds / 2592000);
                if (interval >= 1) {
                    return interval + ' month' + (interval > 1 ? 's' : '') + ' ago';
                }

                interval = Math.floor(seconds / 86400);
                if (interval >= 1) {
                    return interval + ' day' + (interval > 1 ? 's' : '') + ' ago';
                }

                interval = Math.floor(seconds / 3600);
                if (interval >= 1) {
                    return interval + ' hour' + (interval > 1 ? 's' : '') + ' ago';
                }

                interval = Math.floor(seconds / 3600);
                if (interval >= 1) {
                    return interval + ' minute' + (interval > 1 ? 's' : '') + ' ago';
                }

                return interval + ' second' + (interval > 1 ? 's' : '') + ' ago';
            }
        }]);

        return Messages;
    }();

    return Messages;
});