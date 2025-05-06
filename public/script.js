document.getElementById("image").addEventListener("change", function (e) {
  const preview = document.getElementById("imagePreview");
  preview.innerHTML = "";

  if (e.target.files && e.target.files[0]) {
    const reader = new FileReader();

    reader.onload = function (event) {
      const img = document.createElement("img");
      img.src = event.target.result;
      preview.appendChild(img);
    };

    reader.readAsDataURL(e.target.files[0]);
  }
});

let countdownTimer;

function showError(message, isRateLimit = false, headers = null) {
  const errorContainer = document.getElementById("errorContainer");
  const errorMessage = document.getElementById("errorMessage");
  const rateLimitInfo = document.getElementById("rateLimitInfo");

  errorMessage.textContent = message;
  errorContainer.style.display = "block";

  if (isRateLimit && headers) {
    rateLimitInfo.style.display = "block";

    // Get rate limit information from headers
    const limit = headers.get("X-RateLimit-Limit") || "không xác định";
    const remaining = headers.get("X-RateLimit-Remaining") || "0";
    const reset = headers.get("X-RateLimit-Reset") || "60";

    // Update rate limit information in the UI
    document.getElementById("rateLimit").textContent = limit;
    document.getElementById("rateLimitRemaining").textContent = remaining;
    document.getElementById("rateLimitWindow").textContent = "60"; // Assuming window is 60 seconds

    // Set up countdown timer
    const countdown = document.getElementById("countdown");
    let secondsLeft = parseInt(reset, 10);
    countdown.textContent = secondsLeft;

    // Clear any existing timer
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    // Disable the submit button
    document.getElementById("submitBtn").disabled = true;

    // Start countdown
    countdownTimer = setInterval(() => {
      secondsLeft--;
      countdown.textContent = secondsLeft;

      if (secondsLeft <= 0) {
        clearInterval(countdownTimer);
        document.getElementById("submitBtn").disabled = false;
        errorContainer.style.display = "none";
      }
    }, 1000);
  } else {
    rateLimitInfo.style.display = "none";
  }
}

document.getElementById("uploadForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // Hide previous errors
  document.getElementById("errorContainer").style.display = "none";

  const loadingIndicator = document.getElementById("loadingIndicator");
  loadingIndicator.style.display = "block";

  const formData = new FormData(this);

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      // Check for rate limiting
      if (response.status === 429) {
        loadingIndicator.style.display = "none";
        // Extract the JSON error message
        return response.json().then((data) => {
          throw {
            status: 429,
            headers: response.headers,
            message: data.message || "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
          };
        });
      }

      if (!response.ok) {
        throw new Error("Lỗi khi xử lý file");
      }

      return response.blob();
    })
    .then((blob) => {
      // Tạo URL cho blob
      const url = window.URL.createObjectURL(blob);

      // Lưu trữ URL và blob để tải xuống sau
      window.pdfUrl = url;
      window.pdfBlob = blob;

      // Ẩn loading và hiển thị kết quả
      loadingIndicator.style.display = "none";
      const resultContainer = document.getElementById("resultContainer");
      resultContainer.style.display = "block";

      // Thêm iframe để hiển thị preview PDF nếu trình duyệt hỗ trợ
      const pdfPreview = document.getElementById("pdfPreview");

      try {
        // Thử tạo preview PDF
        pdfPreview.style.display = "block";

        // Có 2 cách để hiển thị PDF: iframe hoặc object
        const previewElement = document.createElement("iframe");
        previewElement.src = url;
        previewElement.style.width = "100%";
        previewElement.style.height = "500px";
        previewElement.style.border = "none";

        pdfPreview.innerHTML = "";
        pdfPreview.appendChild(previewElement);
      } catch (e) {
        console.log("Không thể hiển thị preview PDF:", e);
        pdfPreview.style.display = "none";
      }
    })
    .catch((error) => {
      console.error("Lỗi:", error);
      loadingIndicator.style.display = "none";

      if (error.status === 429) {
        showError(error.message, true, error.headers);
      } else {
        showError(error.message || "Đã xảy ra lỗi khi xử lý file ảnh.");
      }
    });
});

// Xử lý sự kiện nút tải xuống
document.getElementById("downloadBtn").addEventListener("click", function () {
  if (window.pdfUrl && window.pdfBlob) {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = window.pdfUrl;
    a.download = "translated_document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

// Thêm nút làm mới để bắt đầu chuyển đổi mới
document.getElementById("uploadForm").addEventListener("reset", function () {
  document.getElementById("resultContainer").style.display = "none";
  document.getElementById("errorContainer").style.display = "none";
  document.getElementById("imagePreview").innerHTML = "";

  // Giải phóng URL khi làm mới
  if (window.pdfUrl) {
    window.URL.revokeObjectURL(window.pdfUrl);
    window.pdfUrl = null;
    window.pdfBlob = null;
  }

  // Clear any countdown timer
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
