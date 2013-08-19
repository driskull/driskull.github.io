define([], function() {
//Default configuration settings for the applciation. This is where you'll define things like a bing maps key, 
//default web map, default app color theme and more. These values can be overwritten by template configuration settings
//and url parameters.
    var defaults = {
        "appid": "", 
        "webmap": "b96c7f8d87994bd784a533a223454143",
        "oauthappid": null,
        //Group templates must support a group url parameter. This will contain the id of the group. 
        //group: "",
        //Enter the url to the proxy if needed by the applcation. See the 'Using the proxy page' help topic for details
        //http://developers.arcgis.com/en/javascript/jshelp/ags_proxy.html
        "proxyurl": "",
        //Example of a template specific property. If your template had several color schemes
        //you could define the default here and setup configuration settings to allow users to choose a different
        //color theme.
        "github":{
            "username": "driskull",
        },
        "lastfm": {
            "user": "retaks",
            "api_key": "05318fce9b3e7cf3e9148de38257ba41"
        },
        "bingmapskey": "", //Enter the url to your organizations bing maps key if you want to use bing basemaps
        "sharinghost": location.protocol + "//" + "www.arcgis.com" //Defaults to arcgis.com. Set this value to your portal or organization host name. 
    };
    return defaults;
});