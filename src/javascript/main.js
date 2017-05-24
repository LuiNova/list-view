define('main', [
    'components/infinite-scroller',
    'components/infinite-scroller-experimental',
    'datasource/messages'
], function(
    InfiniteScroller,
    InfiniteScrollerExperimental,
    Messages
) {
    'use strict';
    
    return {
        init: function() {
            const scroller = document.querySelector('#messages');
            const scrollerExp = document.querySelector('#messages-exp');
            const messagesSource = new Messages({
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