'use strict';
// Original: https://raw.githubusercontent.com/PrismJS/prism-themes/master/themes/prism-ghcolors.css
var theme = {
  plain: {
    color: "#393A34",
    backgroundColor: "#f6f8fa"
  },
  styles: [{
    types: ["comment", "prolog", "doctype", "cdata"],
    style: {
      color: "#a0a0a0",
      fontStyle: "italic"
    }
  }, {
    types: ["namespace"],
  }, {
    types: ["string", "attr-value"],
    style: {
      color: "#80b838"
    }
  }, {
    types: ["class-name"],
    style: {
      color: "#c09b15"
    }
  }, {
    types: ["punctuation", "operator"],
    style: {
      color: "#393A34"
    }
  }, {
    types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"],
    style: {
      color: "#36acaa"
    }
  }, {
    types: ["atrule", "attr-name", "selector"],
    style: {
      color: "#606060",
      fontWeight: 700,
    }
  },
  {
    types: ["keyword"],
    style: {
      color: "#c83895"
    }
  },

  {
    types: ["function-definition", "deleted", "tag"],
    style: {
      color: "#a674e5",
      fontWeight: 700,
    }
  },
  {
    types: ["macro", "property"],
    style: {
      color: "#c09b15",
    }
  },
  {
    types: ["function-variable"],
    style: {
      color: "#6f42c1"
    }
  }, {
    types: ["tag", "selector"],
    style: {
      color: "#000080"
    }
  }
  ]
};

module.exports = theme;
