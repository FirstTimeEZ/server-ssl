setTimeout(() => {
    try {
        const testLoadImage = new Image();
        testLoadImage.src = "bg.png";

        testLoadImage.onload = function () {
            document.getElementById("spinner").hidden = true;
            document.getElementById("started").hidden = false;
            document.getElementById("started-text").hidden = false;
            console.log("Server Started Successfully");
        };

        testLoadImage.onerror = function () {
            document.getElementById("spinner").hidden = true;
            document.getElementById("failed").hidden = false;
            document.getElementById("failed-text").hidden = false;
            console.log("Failed to load test image, something is wrong");
        };
    } catch {
        document.getElementById("spinner").hidden = true;
        document.getElementById("failed").hidden = false;
        document.getElementById("failed-text").hidden = false;
        console.log("Failed to load test image, something is wrong");
    }
}, 2000);