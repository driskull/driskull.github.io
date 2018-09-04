(() => {
  const { pathname } = window.location;
  const distPath = pathname.substring(0, pathname.lastIndexOf("/"));

  const config = {
    packages: [
      {
        name: "flood-map",
        location: `${distPath}/flood-map`,
        main: "Main"
      }
    ]
  };

  window["dojoConfig"] = config;
})();
