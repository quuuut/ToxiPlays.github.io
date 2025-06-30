try {
  var copyable = true;
  document.querySelector("noscript").remove();

  function copycode(obj) {
    if (!copyable) {
      return;
    }
    copyable = false;
    const ogText = obj.innerHTML;
    navigator.clipboard
      .writeText(ogText)
      .then(() => {
        obj.innerHTML = "Copied to clipboard!";
        setTimeout(function () {
          obj.innerHTML = ogText;
          copyable = true;
        }, 3000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        obj.innerHTML =
          "There was an error copying the code to the clipboard. You can refresh and try copying it manually. If you care enough, check the dev console to see what exactly happened.";
      });
  }

  const con = new URLSearchParams(window.location.search);
  const config = Object.fromEntries(con);
  const errBox = document.querySelector("pre.error");
  if (JSON.stringify(config)==="{}") {
    document.querySelector(".show-with-params").style = "display:none";
  } else { 
    errBox.innerHTML = `Caught a ${config["type"]} during '${config["context"]}' section of code:
  **${config["msg"]}**`;
  }

  document.querySelector("body > div.show-with-js").style = "";
  window.history.pushState(
    {},
    document.title,
    window.location.origin + window.location.pathname
  );
} catch (e) {
  prompt(
    "Something must be ROYALLY messed up if you're getting yet another error on this page, since this page is supposed to be the error handler. Oh well, error is in the textbox, copy-paste it and send it to me so I can fix this.",
    e.toString()
  );
  document.location.href = "/";
}
