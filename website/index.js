setTimeout(() => {
    try {
        const testLoadImage = new Image();
        testLoadImage.src = "bg.png";

        document.getElementById("spinner").hidden = true;

        if (testLoadImage.complete) {
            document.getElementById("started").hidden = false;
            document.getElementById("started-text").hidden = false;
            console.log("Server Started Successfully");
            return;
        }
    } catch { }

    document.getElementById("failed").hidden = false;
    document.getElementById("failed-text").hidden = false;
    console.log("Failed to load test image, something is wrong");
}, 2000);