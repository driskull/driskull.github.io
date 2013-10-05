define([
    "dojo/ready", 
    "dojo/_base/declare",
    "dojo/_base/lang",
    "esri/arcgis/utils",
    "esri/IdentityManager",
    "esri/request",
    "modules/mustache",
    "dojo/text!views/error.html",
    "dojo/text!views/job.html",
    "dojo/text!views/org.html",
    "dojo/text!views/repo.html",
    "dojo/text!views/resume.html",
    "dojo/text!views/user.html",
    "dojo/on",
    "dojo/dom",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/request/script"
],
function(
    ready, 
    declare,  
    lang,
    arcgisUtils,
    IdentityManager,
    esriRequest,
    Mustache,
    view_error, view_job, view_org, view_repo, view_resume, view_user,
    on,
    dom,
    array,
    domConstruct,
    domClass,
    domStyle,
    script
) {
    return declare("", null, {
        config: {},
        constructor: function (config) {

            //config will contain application and user defined info for the template such as i18n strings, the web map id
            // and application id
            // any url parameters and any application specific configuration information. 
            this.config = config;

            ready(lang.hitch(this, function () {
                this._init();
            }));
        },
        _getUser: function () {
            var url = 'https://api.github.com/users/' + this.config.github.username;
            return esriRequest({
                url: url,
                content: {},
                handleAs: 'json',
                callbackParamName: 'callback',
            }).then(lang.hitch(this, function (data) {
                data = data.data;
                var sinceDate = new Date(data.created_at);
                var sinceMonth = sinceDate.getMonth();
                var since = sinceDate.getFullYear();
                var currentYear = new Date().getFullYear();


                switch (since) {
                case currentYear - 1:
                    since = 'last year';
                    break;
                case currentYear:
                    since = 'this year';
                    break;
                }


                var addHttp = '';
                if (data.blog && data.blog.indexOf('http') < 0) {
                    addHttp = 'http://';
                }


                var name = this.config.github.username;
                if (data.name) {
                    name = data.name;
                }


                var avatar = '';
                if (data.type === 'Organization') {
                    avatar = data.avatar_url.match(/https:\/\/secure.gravatar.com\/avatar\/[0-9a-z]+/)[0];
                    avatar += '?s=140&amp;d=https://github.com/images/gravatars/gravatar-140.png';
                }


                var view = {
                    name: name,
                    type: data.type,
                    email: data.email,
                    created_at: data.created_at,
                    earlyAdopter: 0,
                    location: data.location,
                    gravatar_id: data.gravatar_id,
                    avatar_url: avatar,
                    repos: data.public_repos,
                    reposLabel: data.public_repos > 1 ? 'repositories' : 'repository',
                    followers: data.followers,
                    followersLabel: data.followers > 1 ? 'followers' : 'follower',
                    username: this.config.github.username,
                    userStatus: 'GitHub user',
                    since: since,
                    resume_url: window.location
                };

                // We consider a limit of 4 months since the GitHub opening (Feb 2008) to be considered as an early adopter
                if (since === '2008' && sinceMonth <= 5) {
                    view.earlyAdopter = 1;
                }

                view.userStatus = this._getUserStatus(data, view);

                if (data.blog !== undefined && data.blog !== null && data.blog !== '') {
                    view.blog = addHttp + data.blog;
                }


                var template = (data.type === 'User' ? view_resume : view_resumeOrgs);


                var node = dom.byId('resume');

                node.innerHTML = Mustache.to_html(template, view);

                document.title = name;

                on(dom.byId('print'), 'click', lang.hitch(this, function () {
                    window.print();
                    return false;
                }));
                this._pageRepos();                
                this._pageOrgs();
                //this._createWebMap();
            }), lang.hitch(this, function (error) {
                console.log(error);
            }));
        },
        _pageOrgs: function(){
            this._github_user_orgs().then(lang.hitch(this, function(response){
                var sorted = [];
                
                var itemCount = 0;
                   
                   
                array.forEach(response.data, lang.hitch(this, function(org, i) {
                    if (!org.login) {
                        return;
                    }
                    sorted.push({position: i, info: org});
                }));
                
                
                
                var now = new Date().getFullYear();

                if (sorted.length > 0) {
                    
                    dom.byId('orgs').innerHTML = '';

                    var name, view, html;
                    

                    array.forEach(sorted, lang.hitch(this, function(org) {

                        name = (org.info.name || org.info.login);
                        view = {
                            name: name,
                            now: now
                        };
                        

                        if (itemCount === sorted.length - 1) {
                            view.last = 'last';
                        }
                        
  
                        html = Mustache.to_html(view_org, view);

                        
                        domConstruct.place(html, dom.byId('orgs'), 'last');
                        
                        ++itemCount;
                        
                    }));
                } else {
                    dom.byId('organizations').destroy();
                }
                
            }));
        },
        _pageRepos: function (page_number, prev_data) {
            var data = (prev_data ? prev_data : []);
            var page = (page_number ? page_number : 1);
            this._github_user_repos(page_number).then(lang.hitch(this, function (repos) {
                data = data.concat(repos.data);
                if (repos.data.length > 0) {
                    this._pageRepos(page + 1, data);
                } else {
                    this._gotRepos(data);
                }
            }));
        },
        _github_user_orgs: function() {
            var url = 'https://api.github.com/users/' + this.config.github.username + '/orgs';
            return esriRequest({
                url: url,
                handleAs: 'json',
                callbackParamName: 'callback',
            });
        },
        _gotRepos: function (data) {

            var sorted = [],
                languages = {},
                popularity;
                
                
            array.forEach(data, lang.hitch(this, function (repo, i) {
                if (repo.fork !== false) {
                    return;
                }

                if (repo.language) {
                    if (repo.language in languages) {
                        languages[repo.language]++;
                    } else {
                        languages[repo.language] = 1;
                    }
                }

                popularity = repo.watchers + repo.forks;
                sorted.push({
                    position: i,
                    popularity: popularity,
                    info: repo
                });
            }));
            
            

            function sortByPopularity(a, b) {
                return b.popularity - a.popularity;
            }

            sorted.sort(sortByPopularity);


            var languageTotal = 0;

            function sortLanguages(languages) {
                var sorted_languages = [];
                var langFunc = function () {
                    return '<a href="https://github.com/languages/' + this.name + '">' + this.name + '</a>';
                };
                for (var lang in languages) {
                    if(languages[lang]){
                        if (typeof (lang) !== "string") {
                            continue;
                        }
                        sorted_languages.push({
                            name: lang,
                            popularity: languages[lang],
                            toString: langFunc
                        });

                        languageTotal += languages[lang];
                    }
                }
                return sorted_languages.sort(sortByPopularity);
            }


            languages = sortLanguages(languages);


            if (languages && languages.length > 0) {
                var ul = domConstruct.create('ul', {
                    className: 'talent'
                }),
                    percent, li;


                array.forEach(languages, lang.hitch(this, function (lang, i) {
                    var x = i + 1;
                    percent = parseInt((lang.popularity / languageTotal) * 100, 10);

                    li = domConstruct.create('li', {
                        innerHTML: lang.toString() + ' (' + percent + '%)'
                    });


                    if (x % 3 === 0 || (languages.length < 3 && i === languages.length - 1)) {
                        domClass.add(li, 'last');

                        domConstruct.place(li, ul, 'last');


                        domConstruct.place(ul, dom.byId('content-languages'), 'last');


                        ul = domConstruct.create('ul', {
                            className: 'talent'
                        });
                    } else {
                        domConstruct.place(li, ul, 'last');
                        domConstruct.place(ul, dom.byId('content-languages'), 'last');
                    }
                }));
            } else {
                domStyle.set(dom.byId('mylanguages'), 'display', 'none');
            }


            if (sorted.length > 0) {
                dom.byId('jobs').innerHTML = '';
                var itemCount = 0;
                var since, until, date, view, html;
                
   
                array.forEach(sorted, lang.hitch(this, function(repo) {

                    since = new Date(repo.info.created_at);
                    since = since.getFullYear();
                    until = new Date(repo.info.pushed_at);
                    until = until.getFullYear();
                    if (since === until) {
                        date = since;
                    } else {
                        date = since + ' - ' + until;
                    }
                    
                    
                    view = {
                        name: repo.info.name,
                        date: date,
                        language: repo.info.language,
                        homepage: repo.info.homepage,
                        description: repo.info.description,
                        username: this.config.github.username,
                        watchers: repo.info.watchers,
                        forks: repo.info.forks,
                        watchersLabel: repo.info.watchers === 0 || repo.info.watchers > 1 ? 'watchers' : 'watcher',
                        forksLabel: repo.info.forks === 0 || repo.info.forks > 1 ? 'forks' : 'fork',
                    };
                    

                    if (itemCount === sorted.length - 1) {
                        view.last = 'last';
                    }

                    html = Mustache.to_html(view_job, view);
                    
                    
                    
                    domConstruct.place(html, dom.byId('jobs'), 'last');

                    ++itemCount;
                }));
            } else {
                dom.byId('jobs').innerHTML = '<p class="enlarge">I do not have any public repositories. Sorry.</p>';
            }

        },
        _github_user_repos: function (page_number) {
            var page = (page_number ? page_number : 1);
            var url = 'https://api.github.com/users/' + this.config.github.username + '/repos';
            return esriRequest({
                url: url,
                content: {
                    page: page
                },
                handleAs: 'json',
                callbackParamName: 'callback',
            });
        },
        _getUserStatus: function (data, view) {
            var COEF_REPOS = 2;
            var COEF_GISTS = 0.25;
            var COEF_FOLLOWERS = 0.5;
            var COEF_FOLLOWING = 0.25;
            var FIRST_STEP = 0;
            var SECOND_STEP = 5;
            var THIRD_STEP = 20;
            var FOURTH_STEP = 50;
            var FIFTH_STEP = 150;
            var EXTRA_POINT_GAIN = 1;

            var statusScore = data.public_repos * COEF_REPOS + data.public_gists * COEF_GISTS + data.followers * COEF_FOLLOWERS + data.following * COEF_FOLLOWING;

            // Extra points
            // - Early adopter
            if (view.earlyAdopter === 1) {
                statusScore += EXTRA_POINT_GAIN;
            }
            // - Blog & Email & Location
            if (view.location && view.location !== '' && view.email && view.email !== '' && data.blog && data.blog !== '') {
                statusScore += EXTRA_POINT_GAIN;
            }

            if (statusScore === FIRST_STEP) {
                return 'Inactive GitHub user';
            } else if (statusScore > FIRST_STEP && statusScore <= SECOND_STEP) {
                return 'Newbie GitHub user';
            } else if (statusScore > SECOND_STEP && statusScore <= THIRD_STEP) {
                return 'Regular GitHub user';
            } else if (statusScore > THIRD_STEP && statusScore <= FOURTH_STEP) {
                return 'Advanced GitHub user';
            } else if (statusScore > FOURTH_STEP && statusScore <= FIFTH_STEP) {
                return 'Enthusiastic GitHub user';
            } else if (statusScore > FIFTH_STEP) {
                return 'Passionate GitHub user';
            }
        },
        _initTwitter: function(){
            script.get(location.protocol + '//platform.twitter.com/widgets.js');
        },
        _init: function () {
            this._getUser().then(this._initTwitter);
        },
        _getRecentTracks: function(){ 
            var url = 'http://ws.audioscrobbler.com/2.0/';
            esriRequest({
                url: url,
                content: {
                    method: 'user.getrecenttracks',
                    user: this.config.lastfm.user,
                    api_key: this.config.lastfm.api_key,
                    format: 'json'          
                },
                handleAs: 'json',
                callbackParamName: 'callback',
            }).then(lang.hitch(this, function(data){
                console.log(data);
            }));
        },
        _getTopArtists: function(){ 
            var url = 'http://ws.audioscrobbler.com/2.0/';
            esriRequest({
                url: url,
                content: {
                    method: 'user.getTopArtists',
                    user: this.config.lastfm.user,
                    api_key: this.config.lastfm.api_key,
                    format: 'json'          
                },
                handleAs: 'json',
                callbackParamName: 'callback',
            }).then(lang.hitch(this, function(data){
                console.log(data);
            }));
        },
        _mapLoaded: function () {
            //this._getRecentTracks();
            //this._getTopArtists();
        },
        //create a map based on the input web map id
        _createWebMap: function () {

            arcgisUtils.createMap(this.config.webmap, "mapDiv", {
                mapOptions: {
                    //Optionally define additional map config here for example you can 
                    //turn the slider off, display info windows, disable wraparound 180, slider position and more. 
                },
                bingMapsKey: this.config.bingmapskey
            }).then(lang.hitch(this, function (response) {
                //Once the map is created we get access to the response which provides important info 
                //such as the map, operational layers, popup info and more. This object will also contain
                //any custom options you defined for the template. In this example that is the 'theme' property.
                //Here' we'll use it to update the application to match the specified color theme.  

                this.map = response.map;

                if (this.map.loaded) {
                    // do something with the map
                    this._mapLoaded();
                } else {
                    on(this.map, "load", function () {
                        // do something with the map
                        this._mapLoaded();
                    });
                }

            }), lang.hitch(this, function (error) {
                //an error occurred - notify the user. In this example we pull the string from the 
                //resource.js file located in the nls folder because we've set the application up 
                //for localization. If you don't need to support mulitple languages you can hardcode the 
                //strings here and comment out the call in index.html to get the localization strings. 
                if (this.config && this.config.i18n) {
                    console.log(this.config.i18n.map.error + ": " + error.message);
                } else {
                     console.log("Unable to create map: " + error.message);
                }

            }));

        }
    });
});