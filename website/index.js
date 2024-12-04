setTimeout(() => {
    try {
        fetch("/api/time").then((response) => {
            response.json().then((time) => {
                document.getElementById("time").innerText = new Date(time).toLocaleTimeString() + " - " + new Date(time).toDateString();
                document.getElementById("time").hidden = false;
                document.getElementById("spinner").hidden = true;
            });
        });

    } catch { }
}, 500);