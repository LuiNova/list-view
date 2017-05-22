define('datasource/messages',[
], function() {
    'use strict';
    
    class Messages {
        constructor(options) {
            this.loadingTemplate = document.querySelector('#templates .scroller__item--loading');
            this.messageTemplate = document.querySelector('#templates .scroller__item');
            
            this.url = options.url;
            this.dataEndpoint = options.dataEndpoint;
            this.dataUrl = `${this.url}${this.dataEndpoint}`;

            this.nextItem = 0;

            this.nextPageToken = null;
        }

        /**
         * Fetch items from datasource.
         */
        fetch(obj, limit) {
            return new Promise((resolve, reject) => {

                let params = obj.params;
                if (params && typeof params === 'object') {
                    params = Object.keys(params).map((key) => {
                        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                    }).join('&');
                }

                const url = params ? obj.url + '?' + params : obj.url;

                let xhr = new XMLHttpRequest();
                xhr.open(obj.method || 'GET', url);

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        reject(xhr.statusText);
                    }
                };

                xhr.onerror = () => {
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

        next() {
            let options = {
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

            return this.fetch(options).then((response) => {
                let jsonResponse = JSON.parse(response);
                this.nextPageToken = jsonResponse.pageToken;
                return jsonResponse.messages;
            });

            // return this.fetch(options);
        }

        /**
         * Create a loading element, all loading elements are identical
         */
        createLoadingElement() {
            return this.loadingTemplate.cloneNode(true);
        }

        /**
         * Render an item, reusing the provided div if provided
         */
        render(item, div) {
            div = div || this.messageTemplate.cloneNode(true);

            div.dataset.id = item.id;

            div.querySelector('.card__avatar').src = `${this.url}${item.author.photoUrl}`;
            div.querySelector('.card__title').textContent = item.author.name;
            div.querySelector('.card__subtitle').textContent = this.timeSince(new Date(item.updated)); //item.updated.toString();
            div.querySelector('.card__content').textContent = item.content;

            return div;
        }

        timeSince(date) {
            if (typeof date !== 'object') {
                date = new Date(date);
            }

            let seconds = Math.floor((new Date() - date) / 1000),
                interval = Math.floor(seconds / 31536000);

            if (interval >= 1) {
                return `${interval} year${interval > 1 ? 's' : ''} ago`;
            }

            interval = Math.floor(seconds / 2592000);
            if (interval >= 1) {
                return `${interval} month${interval > 1 ? 's' : ''} ago`;
            }

            interval = Math.floor(seconds / 86400);
            if (interval >= 1) {
                return `${interval} day${interval > 1 ? 's' : ''} ago`;
            }

            interval = Math.floor(seconds / 3600);
            if (interval >= 1) {
                return `${interval} hour${interval > 1 ? 's' : ''} ago`;
            }

            interval = Math.floor(seconds / 3600);
            if (interval >= 1) {
                return `${interval} minute${interval > 1 ? 's' : ''} ago`;
            }

            return `${interval} second${interval > 1 ? 's' : ''} ago`;
        }
    }

    return Messages;
});