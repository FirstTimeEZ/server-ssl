document.querySelector('*').addEventListener('dragstart', function (event) { event.preventDefault(); });

setTimeout(() => {
    try {
        fetch("/api/time").then((response) => {
            response.json().then((time) => {
                if (time != undefined && time != "") {
                    document.getElementById("time").innerText = new Date(time).toTimeString() + "\n" + new Date(time).toDateString();
                    document.getElementById("time").hidden = false;
                    document.getElementById("spinner").hidden = true;
                }
            });
        });

    } catch { }
}, 500);