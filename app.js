/* global React, ReactDOM, QRCode */

const { useEffect, useMemo, useRef, useState } = React;

const mockCarparks = [
  {
    id: "CP-001",
    name: "Britomart East Carpark",
    lat: -36.8441,
    lng: 174.7684,
    address: "50 Quay Street, Auckland",
    defaultAmount: 65,
  },
  {
    id: "CP-002",
    name: "Queen Street Central",
    lat: -36.8485,
    lng: 174.7633,
    address: "210 Queen Street, Auckland",
    defaultAmount: 85,
  },
  {
    id: "CP-003",
    name: "Viaduct Harbour",
    lat: -36.8415,
    lng: 174.7596,
    address: "15 Halsey Street, Auckland",
    defaultAmount: 95,
  },
];

function distanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 6371 * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function getNearestCarpark(position) {
  const sorted = [...mockCarparks]
    .map((park) => ({
      park,
      distance: distanceKm(position, park),
    }))
    .sort((a, b) => a.distance - b.distance);
  return sorted[0];
}

let googleMapsPromise = null;

function loadGoogleMaps(apiKey) {
  if (googleMapsPromise) {
    return googleMapsPromise;
  }
  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mapsKey, setMapsKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [mapStatus, setMapStatus] = useState(
    "Google Maps will load once a valid API key is saved."
  );
  const [locationStatus, setLocationStatus] = useState(
    "Waiting for GPS permission."
  );
  const [cameraStatus, setCameraStatus] = useState(
    "If the camera does not open, ensure this page is served over HTTPS or from a local server (not a file viewer)."
  );
  const [capturePrompt, setCapturePrompt] = useState(
    "Photo 1 of 3 — Align the plate within the frame."
  );
  const [photos, setPhotos] = useState([null, null, null]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [plateInput, setPlateInput] = useState("");
  const [plateHelper, setPlateHelper] = useState("");
  const [plateConfirmVisible, setPlateConfirmVisible] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [carpark, setCarpark] = useState(null);
  const [amount, setAmount] = useState(0);
  const [nearestDistance, setNearestDistance] = useState(null);
  const [noticeIssuedAt, setNoticeIssuedAt] = useState(null);
  const [noticeAttached, setNoticeAttached] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    lat: -36.8485,
    lng: 174.7633,
  });

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const payQrRef = useRef(null);
  const appealQrRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const storedMapsKey = localStorage.getItem("nzes.mapsKey") || "";
    const storedGeminiKey = localStorage.getItem("nzes.geminiKey") || "";
    if (storedMapsKey) {
      setMapsKey(storedMapsKey);
    }
    if (storedGeminiKey) {
      setGeminiKey(storedGeminiKey);
    }
  }, []);

  useEffect(() => {
    if (!mapsKey) {
      setMapStatus("Add a Google Maps API key to load the map.");
      return;
    }
    let mounted = true;
    setMapStatus("Loading Google Maps…");
    loadGoogleMaps(mapsKey)
      .then(() => {
        if (!mounted) {
          return;
        }
        initGoogleMap();
        setMapStatus("Google Maps loaded.");
        requestLocation();
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setMapStatus("Google Maps failed to load. Check your API key.");
      });
    return () => {
      mounted = false;
    };
  }, [mapsKey]);

  useEffect(() => {
    if (currentScreen !== "print") {
      return;
    }
    if (!payQrRef.current || !appealQrRef.current) {
      return;
    }
    QRCode.toCanvas(payQrRef.current, "https://payments.nzenforcement.co.nz", {
      width: 120,
      margin: 1,
    });
    QRCode.toCanvas(appealQrRef.current, "https://appeals.nzenforcement.co.nz", {
      width: 120,
      margin: 1,
    });
  }, [currentScreen, noticeIssuedAt]);

  const statusStyle = useMemo(
    () => ({
      background: isOnline ? "#e5f7eb" : "#fff1f0",
      color: isOnline ? "#1f7a3f" : "#b42318",
    }),
    [isOnline]
  );

  function initGoogleMap() {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }
    const defaultPosition = { lat: -36.8485, lng: 174.7633 };
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: defaultPosition,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mockCarparks.forEach((park) => {
      new google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: park.lat, lng: park.lng },
        title: park.name,
      });
    });
  }

  function updateCurrentLocation(coords) {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) {
      return;
    }
    mapInstanceRef.current.setCenter(coords);
    mapInstanceRef.current.setZoom(16);
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    markerRef.current = new google.maps.Marker({
      map: mapInstanceRef.current,
      position: coords,
      title: "Current location",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#1c4fd7",
        fillOpacity: 0.9,
        strokeColor: "#1c4fd7",
        strokeWeight: 2,
      },
    });
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported.");
      return;
    }
    setLocationStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(coords);
        updateCurrentLocation(coords);
        setLocationStatus("Location centered.");
      },
      (error) => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Enable GPS permissions to center the map."
            : "Unable to read GPS. Check location settings."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function readPlateWithGemini(dataUrl) {
    if (!geminiKey || !navigator.onLine) {
      setPlateHelper(
        "Offline or missing Gemini API key. Enter the registration manually."
      );
      return;
    }
    setPlateHelper("Reading plate with Gemini…");
    const base64 = dataUrl.split(",")[1];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      "Read the vehicle registration plate from this image. " +
                      "Respond with only the plate text, no punctuation or extra words.",
                  },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: base64,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );
      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (text) {
        const cleaned = text.replace(/\s+/g, "").toUpperCase();
        setPlateInput(cleaned);
        setPlateHelper(`Detected plate: ${cleaned}`);
      } else {
        setPlateHelper("Unable to detect the plate. Please enter it manually.");
      }
    } catch (error) {
      setPlateHelper("Gemini failed to read the plate. Please enter it manually.");
    }
  }

  function resetCapture() {
    setPhotos([null, null, null]);
    setCurrentPhotoIndex(0);
    setPlateInput("");
    setPlateHelper("");
    setPlateConfirmVisible(false);
    setCapturePrompt("Photo 1 of 3 — Align the plate within the frame.");
    setPhotoCaptured(false);
    stopCamera();
  }

  function handlePhotoData(dataUrl) {
    setPhotos((prev) => {
      const next = [...prev];
      next[currentPhotoIndex] = dataUrl;
      return next;
    });
    setPhotoCaptured(true);
    stopCamera();

    if (currentPhotoIndex === 0) {
      setPlateConfirmVisible(true);
      if (navigator.onLine) {
        readPlateWithGemini(dataUrl);
      } else {
        setPlateHelper("Offline mode: enter the vehicle registration manually.");
      }
    } else {
      moveToNextPhoto();
    }
  }

  function moveToNextPhoto() {
    if (currentPhotoIndex < 2) {
      const nextIndex = currentPhotoIndex + 1;
      setCurrentPhotoIndex(nextIndex);
      setCapturePrompt(
        `Photo ${nextIndex + 1} of 3 — Capture the vehicle context.`
      );
      setPlateConfirmVisible(false);
      setPhotoCaptured(false);
    } else {
      setCurrentScreen("reason");
    }
  }

  function handleStartNotice() {
    resetCapture();
    setCurrentScreen("capture");
    setCameraStatus(
      "If the camera does not open, ensure this page is served over HTTPS or from a local server (not a file viewer)."
    );
  }

  async function handleOpenCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(
        "Camera access requires HTTPS or a local server. File viewers often block camera access."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setPhotoCaptured(false);
      setCameraStatus("Camera ready. Tap Capture Photo.");
    } catch (error) {
      setCameraStatus(
        "Camera permission denied. Allow camera access to capture photos."
      );
    }
  }

  function handleCapturePhoto() {
    if (!cameraStreamRef.current || !videoRef.current || !canvasRef.current) {
      setCameraStatus("Camera is not active. Tap Open Camera first.");
      return;
    }
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    handlePhotoData(dataUrl);
  }

  function handleFileChange(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handlePhotoData(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleRetake() {
    setPhotos((prev) => {
      const next = [...prev];
      next[currentPhotoIndex] = null;
      return next;
    });
    setPhotoCaptured(false);
    setPlateConfirmVisible(false);
    stopCamera();
  }

  function handleConfirmPlate() {
    if (!plateInput.trim()) {
      setPlateHelper("Please confirm the vehicle registration.");
      return;
    }
    setPlateInput(plateInput.trim().toUpperCase());
    setPlateConfirmVisible(false);
    moveToNextPhoto();
  }

  function handleReasonSubmit(event) {
    event.preventDefault();
    if (!reason) {
      window.alert("Please select a reason for the infringement.");
      return;
    }
    const nearest = getNearestCarpark(currentLocation);
    setCarpark(nearest.park);
    setAmount(nearest.park.defaultAmount);
    setNearestDistance(nearest.distance);
    setCurrentScreen("review");
  }

  function handleConfirmDetails() {
    setNoticeIssuedAt(new Date());
    setCurrentScreen("print");
  }

  function handlePrintNotice() {
    setNoticeAttached(false);
    setCurrentScreen("attach");
  }

  function handleConfirmAttached() {
    setNoticeAttached(true);
    setCurrentScreen("home");
  }

  function handleReprint() {
    setCurrentScreen("print");
  }

  function handleSaveKeys() {
    const trimmedMapsKey = mapsKey.trim();
    const trimmedGeminiKey = geminiKey.trim();
    if (trimmedMapsKey) {
      localStorage.setItem("nzes.mapsKey", trimmedMapsKey);
    }
    if (trimmedGeminiKey) {
      localStorage.setItem("nzes.geminiKey", trimmedGeminiKey);
    }
    setMapStatus("Keys saved. Reloading map…");
    if (trimmedMapsKey) {
      setMapsKey(trimmedMapsKey);
    }
    if (trimmedGeminiKey) {
      setGeminiKey(trimmedGeminiKey);
    }
  }

  const previewImage = photos[currentPhotoIndex];

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <p className="eyebrow">New Zealand Enforcement Services</p>
          <h1>Mobile Enforcement Console</h1>
        </div>
        <div className="status" style={statusStyle}>
          {isOnline ? "Online" : "Offline"}
        </div>
      </header>

      <section className={`panel ${currentScreen === "home" ? "" : "hidden"}`}>
        <div className="panel__header">
          <h2>Live Carpark Map</h2>
          <p>Centered on your GPS location. Nearby NZES locations are pinned.</p>
        </div>
        <div className="settings">
          <label>
            Google Maps API Key
            <input
              type="password"
              placeholder="Paste Google Maps API key"
              autoComplete="off"
              value={mapsKey}
              onChange={(event) => setMapsKey(event.target.value)}
            />
          </label>
          <label>
            Gemini API Key
            <input
              type="password"
              placeholder="Paste Gemini API key"
              autoComplete="off"
              value={geminiKey}
              onChange={(event) => setGeminiKey(event.target.value)}
            />
          </label>
          <button className="secondary" type="button" onClick={handleSaveKeys}>
            Save Keys
          </button>
        </div>
        <div className="map-actions">
          <button className="secondary" type="button" onClick={requestLocation}>
            Use My Location
          </button>
          <span className="helper">{locationStatus}</span>
        </div>
        <p className="helper">{mapStatus}</p>
        <div className="map">
          <div className="map__fallback">
            <p>Map loading…</p>
          </div>
          <div
            id="map"
            ref={mapRef}
            style={{ position: "absolute", inset: 0 }}
          ></div>
        </div>
        <div className="panel__footer">
          <button className="primary" type="button" onClick={handleStartNotice}>
            Issue Infringement Notice
          </button>
        </div>
      </section>

      <section
        className={`panel ${currentScreen === "capture" ? "" : "hidden"}`}
      >
        <div className="panel__header">
          <h2>Capture Vehicle Evidence</h2>
          <p>{capturePrompt}</p>
        </div>
        <div className="capture">
          <div
            className={`capture__frame ${
              cameraActive ? "camera-active" : ""
            } ${photoCaptured ? "photo-captured" : ""}`}
          >
            <div className="guide">
              <span className="guide__label">Align plate here</span>
            </div>
            <video ref={videoRef} playsInline autoPlay muted></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <img src={previewImage || ""} alt="Captured preview" />
          </div>
          <button className="primary" type="button" onClick={handleOpenCamera}>
            Open Camera
          </button>
          <button
            className="secondary"
            type="button"
            onClick={handleCapturePhoto}
          >
            Capture Photo
          </button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
          <p className="helper">{cameraStatus}</p>
          <button className="secondary" type="button" onClick={handleRetake}>
            Retake photo
          </button>
        </div>
        <div
          className={`plate-confirm ${plateConfirmVisible ? "" : "hidden"}`}
        >
          <label htmlFor="plateInput">Confirm vehicle registration</label>
          <input
            id="plateInput"
            type="text"
            maxLength="10"
            placeholder="e.g. NZE123"
            value={plateInput}
            onChange={(event) => setPlateInput(event.target.value)}
          />
          <p className="helper">{plateHelper}</p>
          <button className="primary" type="button" onClick={handleConfirmPlate}>
            Confirm Plate
          </button>
        </div>
      </section>

      <section
        className={`panel ${currentScreen === "reason" ? "" : "hidden"}`}
      >
        <div className="panel__header">
          <h2>Reason for Infringement Notice</h2>
          <p>Select the most appropriate reason.</p>
        </div>
        <form className="reason" onSubmit={handleReasonSubmit}>
          <label>
            <input
              type="radio"
              name="reason"
              value="Exceeded Grace Period"
              checked={reason === "Exceeded Grace Period"}
              onChange={(event) => setReason(event.target.value)}
            />
            Exceeded Grace Period
          </label>
          <label>
            <input
              type="radio"
              name="reason"
              value="Exceeded Allowed Parking Time"
              checked={reason === "Exceeded Allowed Parking Time"}
              onChange={(event) => setReason(event.target.value)}
            />
            Exceeded Allowed Parking Time
          </label>
          <label>
            <input
              type="radio"
              name="reason"
              value="Parked in Reserved or Private Space"
              checked={reason === "Parked in Reserved or Private Space"}
              onChange={(event) => setReason(event.target.value)}
            />
            Parked in Reserved or Private Space
          </label>
          <label>
            <input
              type="radio"
              name="reason"
              value="Other"
              checked={reason === "Other"}
              onChange={(event) => setReason(event.target.value)}
            />
            Other
          </label>
          <textarea
            maxLength="150"
            placeholder="Provide additional details (max 150 characters)"
            value={otherReason}
            onChange={(event) => setOtherReason(event.target.value)}
          ></textarea>
          <button className="primary" type="submit">
            Continue
          </button>
        </form>
      </section>

      <section
        className={`panel ${currentScreen === "review" ? "" : "hidden"}`}
      >
        <div className="panel__header">
          <h2>Review &amp; Confirm Details</h2>
          <p>Verify evidence, carpark data, and infringement amount.</p>
        </div>
        <div className="review">
          <div className="review__photos">
            {photos.filter(Boolean).map((src, index) => (
              <img key={src} src={src} alt={`Photo ${index + 1}`} />
            ))}
          </div>
          <div className="review__details">
            <h3>Infringement Summary</h3>
            <ul>
              <li>
                <strong>Carpark:</strong> {carpark?.name}
              </li>
              <li>
                <strong>Address:</strong> {carpark?.address}
              </li>
              <li>
                <strong>Vehicle Registration:</strong> {plateInput}
              </li>
              <li>
                <strong>Reason:</strong> {reason}
              </li>
              {reason === "Other" && otherReason ? (
                <li>
                  <strong>Additional detail:</strong> {otherReason}
                </li>
              ) : null}
              <li>
                <strong>Infringement Amount:</strong> ${amount}
              </li>
              {nearestDistance !== null ? (
                <li>
                  <strong>Matched via GPS:</strong> {nearestDistance.toFixed(2)}
                  {" "}km away
                </li>
              ) : null}
            </ul>
            <button
              className="primary"
              type="button"
              onClick={handleConfirmDetails}
            >
              Confirm Details
            </button>
          </div>
        </div>
      </section>

      <section
        className={`panel ${currentScreen === "print" ? "" : "hidden"}`}
      >
        <div className="panel__header">
          <h2>Print Infringement Notice</h2>
          <p>Review the notice exactly as it will be printed.</p>
        </div>
        <div className="notice">
          <div className="notice__header">
            <h3>New Zealand Enforcement Services</h3>
            <p>Private Parking Enforcement Notice</p>
          </div>
          <div className="notice__body">
            <p>
              <strong>Carpark:</strong> {carpark?.name}
            </p>
            <p>
              <strong>Address:</strong> {carpark?.address}
            </p>
            <p>
              <strong>Vehicle Registration:</strong> {plateInput}
            </p>
            <p>
              <strong>Reason:</strong> {reason}
              {reason === "Other" && otherReason ? ` — ${otherReason}` : ""}
            </p>
            <p>
              <strong>Infringement Amount:</strong> ${amount}
            </p>
            <p>
              <strong>Notice Issued:</strong>{" "}
              {noticeIssuedAt
                ? noticeIssuedAt.toLocaleString()
                : new Date().toLocaleString()}
            </p>
          </div>
          <div className="notice__qr">
            <div>
              <canvas ref={payQrRef}></canvas>
              <p>To pay this notice</p>
              <small>https://payments.nzenforcement.co.nz</small>
            </div>
            <div>
              <canvas ref={appealQrRef}></canvas>
              <p>To appeal this notice</p>
              <small>https://appeals.nzenforcement.co.nz</small>
            </div>
          </div>
        </div>
        <div className="panel__footer">
          <button className="primary" type="button" onClick={handlePrintNotice}>
            Print Notice
          </button>
        </div>
      </section>

      <section
        className={`panel ${currentScreen === "attach" ? "" : "hidden"}`}
      >
        <div className="panel__header">
          <h2>Attach Notice</h2>
          <p>Confirm the notice has been placed on the vehicle windscreen.</p>
        </div>
        <div className="attach">
          <button
            className="primary"
            type="button"
            onClick={handleConfirmAttached}
          >
            Confirm Notice Attached
          </button>
          <button className="secondary" type="button" onClick={handleReprint}>
            Reprint Notice
          </button>
        </div>
      </section>

      {noticeAttached ? (
        <div className="hidden">Notice attached confirmed.</div>
      ) : null}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
