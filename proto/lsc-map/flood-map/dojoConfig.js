(function () {
    var pathname = window.location.pathname;
    var distPath = pathname.substring(0, pathname.lastIndexOf("/"));
    var config = {
        packages: [
            {
                name: "flood-map",
                location: distPath + "/flood-map",
                main: "Main"
            }
        ]
    };
    window["dojoConfig"] = config;
})();
//# sourceMappingURL=dojoConfig.js.map