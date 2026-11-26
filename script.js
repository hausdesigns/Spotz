const SUPABASE_URL = "https://ypzrgdpkdlhhqjrsdkfx.supabase.co";
const SUPABASE_KEY = "sb_publishable_znXCoggP9xcWYi0IFbjeKg_g373OUOD";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Spotz connected to Supabase!");








/* ==========================
   INITIALIZE MAP
========================== */

let map;
let marker;

document.addEventListener("DOMContentLoaded", function() {

    map = L.map("map").setView([39.5, -98.35], 4);

    L.tileLayer(
         "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_5gbr_1_65a44838969aa8efea0ea184",
    {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 20
        }
    ).addTo(map);

}); // THIS WAS MISSING!


/* ==========================
   DISPLAY LOCATION ON MAP
========================== */

function showLocation(lat, lon, name) {

    map.setView([lat, lon], 12);

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(name)
        .openPopup();

}


/* ==========================
   SEARCH FOR A CITY
========================== */

function searchCity(event) {

    event.preventDefault();

    const city = document.getElementById("citySearch").value.trim();
    const result = document.getElementById("locationResult");

    if (!city) return;

    result.textContent = "Searching...";

    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`)

        .then(response => response.json())

        .then(data => {

            if (data.length === 0) {
                result.textContent = "City not found.";
                return;
            }

            const place = data[0];

            showLocation(
                parseFloat(place.lat),
                parseFloat(place.lon),
                place.display_name
            );

            result.textContent = "Showing results for " + city;

        })

        .catch(error => {
            result.textContent = "Unable to search. Please try again.";
            console.error(error);
        });

}


/* ==========================
   FIND CURRENT LOCATION
========================== */

function findLocation() {

    const result = document.getElementById("locationResult");

    if (!navigator.geolocation) {
        result.textContent = "Location is not supported.";
        return;
    }

    result.textContent = "Finding your location...";

    navigator.geolocation.getCurrentPosition(

        function(position) {

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)

                .then(response => response.json())

                .then(data => {

                    const address = data.address;

                    const city = address.city ||
                                 address.town ||
                                 address.village ||
                                 address.county ||
                                 "Your location";

                    document.getElementById("citySearch").value = city;

                    showLocation(lat, lon, city);

                    result.textContent = "Showing your location: " + city;

                })
                .catch(error => {
                    result.textContent = "Unable to find your city.";
                    console.error(error);
                });

        },

        function() {
            result.textContent = "Please allow location access.";
        }

    );

}

// SPOTZ USER ACCOUNTS

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const accountMessage = document.getElementById("accountMessage");
const userAccount = document.getElementById("userAccount");
const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");

// CREATE ACCOUNT
signupForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    accountMessage.textContent = "Creating your account...";

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username
            }
        }
    });

    if (error) {
        accountMessage.textContent = error.message;
        return;
    }

    if (data.session) {
        accountMessage.textContent = "Welcome to Spotz!";
        signupForm.reset();
        updateAccountDisplay(data.user);
    } else {
        accountMessage.textContent =
            "Account created! Check your email to confirm your account.";
        signupForm.reset();
    }
});

// LOG IN
loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    accountMessage.textContent = "Logging in...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        accountMessage.textContent = error.message;
        return;
    }

    accountMessage.textContent = "You're logged in!";
    loginForm.reset();
    updateAccountDisplay(data.user);
});

// LOG OUT
logoutButton.addEventListener("click", async function() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        accountMessage.textContent = error.message;
        return;
    }

    accountMessage.textContent = "You have logged out.";
    updateAccountDisplay(null);
});

// UPDATE ACCOUNT DISPLAY
function updateAccountDisplay(user) {
    if (user) {
        signupForm.hidden = true;
        loginForm.hidden = true;
        userAccount.hidden = false;

        const username = user.user_metadata?.username || user.email;
        welcomeMessage.textContent = "Welcome, " + username + "!";
    } else {
        signupForm.hidden = false;
        loginForm.hidden = false;
        userAccount.hidden = true;
    }
}

// CHECK EXISTING LOGIN SESSION
async function checkLoginSession() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("Session check:", error.message);
        return;
    }

    updateAccountDisplay(data.user);
}

checkLoginSession();


// =====================================
// SPOTZ: SHARE A SPOT
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    const spotForm = document.getElementById("spotForm");
    const spotMessage = document.getElementById("spotMessage");

    // Create a group to hold Spotz map markers
    const spotMarkers = L.layerGroup().addTo(map);


    // =====================================
    // LOAD EXISTING SPOTS ON THE MAP
    // =====================================

    async function loadSpotz() {

        const { data, error } = await supabaseClient
            .from("spots")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Could not load spots:", error.message);
            return;
        }

        spotMarkers.clearLayers();

        data.forEach(function (spot) {

            if (spot.latitude == null || spot.longitude == null) {
                return;
            }

            const popup = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent = spot.title;

            const description = document.createElement("p");
            description.textContent = spot.description || "";

            popup.appendChild(title);
            popup.appendChild(description);

            if (spot.photo_url) {
                const photo = document.createElement("img");
                photo.src = spot.photo_url;
                photo.alt = spot.title;
                photo.style.width = "180px";
                photo.style.borderRadius = "8px";
                popup.appendChild(photo);
            }

            L.marker([spot.latitude, spot.longitude])
                .bindPopup(popup)
                .addTo(spotMarkers);
        });
    }


    // =====================================
    // TURN AN ADDRESS INTO MAP COORDINATES
    // =====================================

    async function getSpotCoordinates(location) {

        const response = await fetch(
            "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
            encodeURIComponent(location)
        );

        if (!response.ok) {
            throw new Error("Could not search for that location.");
        }

        const results = await response.json();

        if (!results.length) {
            throw new Error("Location not found. Try a more specific address.");
        }

        return {
            latitude: Number(results[0].lat),
            longitude: Number(results[0].lon)
        };
    }


    // =====================================
    // SUBMIT A NEW SPOT
    // =====================================

    spotForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        try {

            spotMessage.textContent = "Sharing your spot...";

            const { data: { user }, error: userError } =
                await supabaseClient.auth.getUser();

            if (userError || !user) {
                throw new Error("Please log in before sharing a spot.");
            }

            const title = document.getElementById("spotTitle").value.trim();
            const description = document.getElementById("spotDescription").value.trim();
            const category = document.getElementById("spotCategory").value;
            const location = document.getElementById("spotLocation").value.trim();
            const photoFile = document.getElementById("spotPhoto").files[0];

            if (!photoFile) {
                throw new Error("Please choose a photo.");
            }

            if (!photoFile.type.startsWith("image/")) {
                throw new Error("Please upload an image file.");
            }

            if (photoFile.size > 5 * 1024 * 1024) {
                throw new Error("Your photo must be smaller than 5 MB.");
            }

            // Find the location's coordinates
            const coordinates = await getSpotCoordinates(location);

            // Prepare a unique photo filename
            const safeFileName = photoFile.name.replace(
                /[^a-zA-Z0-9._-]/g,
                "-"
            );

            const filePath =
                user.id + "/" + Date.now() + "-" + safeFileName;

            // Upload photo to Supabase Storage
            const { error: uploadError } = await supabaseClient
                .storage
                .from("Spotz-photos")
                .upload(filePath, photoFile, {
                    contentType: photoFile.type,
                    cacheControl: "3600",
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            // Get the public photo URL
            const { data: photoData } = supabaseClient
                .storage
                .from("Spotz-photos")
                .getPublicUrl(filePath);

            const photoURL = photoData.publicUrl;

            // Save the new spot in the database
            const { error: insertError } = await supabaseClient
                .from("spots")
                .insert({
                    user_id: user.id,
                    title: title,
                    description: description,
                    category: category,
                    location_name: location,
                    photo_url: photoURL,
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude
                });

            if (insertError) {
                throw insertError;
            }

            // Refresh map markers
            await loadSpotz();

            // Zoom map to the new spot
            map.setView(
                [coordinates.latitude, coordinates.longitude],
                13
            );

            spotMessage.textContent = "Your spot has been shared!";

            spotForm.reset();

        } catch (error) {

            console.error("Spotz error:", error);

            spotMessage.textContent =
                error.message || "Something went wrong. Please try again.";

        }

    });


    // Load previously shared spots
    loadSpotz();

});
