const path = require("path");
const pkg = require("./package.json");

module.exports = {
  ...pkg.build,

  dmg: {
    ...pkg.build.dmg,

    contents: [
      ...pkg.build.dmg.contents,
        {
          x: 590,
          y: 422,
          type: "file",
          path: path.join(
            __dirname,
            "build",
            "Installation Help.html"
          )
        }
    ]
  }
};
