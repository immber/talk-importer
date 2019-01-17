const h = require('highland');
module.exports = {
  /**
   * Turn the collection into a Talk asset
   *
   * @param {Object} fyre
   * @return {Object}
   */
  translate: fyre => {
    var asset = {
      id: fyre.id,
      url: fyre.source, // This url needs to be added in the permitted domains section of your Talk admin
      title: fyre.title,
      scraped: null, // Set to null because next visit to page will trigger scrape
    };
    return h([asset]);
  },

  validate: fyre => {
    //just logs the url to STDOUT so we can upated permitted domains list
    //TODO: Add validation that source data contains expected data points
    console.log(fyre.source);
    return h([fyre]);
  },
};
