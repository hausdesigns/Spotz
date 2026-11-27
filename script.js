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
        },
        emailRedirectTo: "https://hausdesigns.github.io/SpotzLive/"
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

    const profileSection = document.getElementById("profile");

    if (user) {

        signupForm.hidden = true;
        loginForm.hidden = true;
        userAccount.hidden = false;

        const username =
            user.user_metadata?.username || user.email;

        welcomeMessage.textContent = "Welcome, " + username + "!";

        // SHOW PROFILE
        profileSection.hidden = false;

        // LOAD PROFILE INFORMATION
        loadProfile();

    } else {

        signupForm.hidden = false;
        loginForm.hidden = false;
        userAccount.hidden = true;

        // HIDE PROFILE
        profileSection.hidden = true;
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
        popup.style.minWidth = "200px";

        // SPOT TITLE
        const title = document.createElement("h3");
        title.textContent = spot.title;
        popup.appendChild(title);

        // SPOT DESCRIPTION
        const description = document.createElement("p");
        description.textContent = spot.description || "";
        popup.appendChild(description);

        // SPOT PHOTO
        if (spot.photo_url) {
            const photo = document.createElement("img");
            photo.src = spot.photo_url;
            photo.alt = spot.title;
            photo.style.width = "180px";
            photo.style.borderRadius = "8px";
            popup.appendChild(photo);
        }


        // =====================================
        // LIKE BUTTON
        // =====================================

        const likeSection = document.createElement("div");

        const likeButton = document.createElement("button");
        likeButton.type = "button";

        const likeCount = document.createElement("span");
        likeCount.style.marginLeft = "8px";

        likeSection.appendChild(likeButton);
        likeSection.appendChild(likeCount);

        popup.appendChild(likeSection);

        // LOAD LIKE INFORMATION
        async function loadLikes() {

            const { data: likes, error } = await supabaseClient
                .from("likes")
                .select("user_id")
                .eq("spot_id", spot.id);

            if (error) {
                console.error("Could not load likes:", error.message);
                likeCount.textContent = " Likes unavailable";
                return;
            }

            const { data: userData } =
                await supabaseClient.auth.getUser();

            const currentUser = userData.user;

            const alreadyLiked = currentUser &&
                likes.some(like => like.user_id === currentUser.id);

            likeButton.textContent = alreadyLiked ? "❤️ Liked" : "🤍 Like";
            likeCount.textContent = likes.length + 
                (likes.length === 1 ? " like" : " likes");
        }

        // LIKE / UNLIKE
        likeButton.addEventListener("click", async function () {

            const { data: userData } =
                await supabaseClient.auth.getUser();

            const currentUser = userData.user;

            if (!currentUser) {
                alert("Please log in to like a Spot.");
                return;
            }

            likeButton.disabled = true;

            const { data: existingLike, error: findError } =
                await supabaseClient
                    .from("likes")
                    .select("id")
                    .eq("spot_id", spot.id)
                    .eq("user_id", currentUser.id)
                    .maybeSingle();

            if (findError) {
                console.error("Could not check like:", findError.message);
                alert("Could not update your like.");
                likeButton.disabled = false;
                return;
            }

            if (existingLike) {

                const { error } = await supabaseClient
                    .from("likes")
                    .delete()
                    .eq("id", existingLike.id);

                if (error) {
                    console.error("Could not remove like:", error.message);
                    alert("Could not remove your like.");
                }

            } else {

                const { error } = await supabaseClient
                    .from("likes")
                    .insert({
                        spot_id: spot.id,
                        user_id: currentUser.id
                    });

                if (error) {
                    console.error("Could not add like:", error.message);
                    alert("Could not add your like.");
                }
            }

            await loadLikes();

            likeButton.disabled = false;
        });

        // INITIAL LIKE COUNT
        loadLikes();


        // COMMENTS HEADING
        const commentsHeading = document.createElement("h4");
        commentsHeading.textContent = "Comments";
        popup.appendChild(commentsHeading);

        // COMMENTS DISPLAY
        const commentsContainer = document.createElement("div");
        popup.appendChild(commentsContainer);

        // COMMENT FORM
        const commentForm = document.createElement("form");

        const commentInput = document.createElement("textarea");
        commentInput.placeholder = "Write a comment...";
        commentInput.required = true;
        commentInput.maxLength = 1000;
        commentInput.style.width = "100%";

        const commentButton = document.createElement("button");
        commentButton.type = "submit";
        commentButton.textContent = "Post Comment";

        commentForm.appendChild(commentInput);
        commentForm.appendChild(commentButton);
        popup.appendChild(commentForm);

        // LOAD COMMENTS
        async function loadComments() {

            commentsContainer.textContent = "Loading comments...";

            const { data: comments, error } = await supabaseClient
                .from("comments")
                .select("*")
                .eq("spot_id", spot.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Could not load comments:", error.message);
                commentsContainer.textContent = "Could not load comments.";
                return;
            }

            commentsContainer.replaceChildren();

            if (!comments || comments.length === 0) {
                commentsContainer.textContent = "No comments yet. Be the first!";
                return;
            }

            comments.forEach(function (comment) {

                const commentItem = document.createElement("p");
                commentItem.textContent = comment.content;

                const commentDate = document.createElement("small");
                commentDate.textContent =
                    new Date(comment.created_at).toLocaleDateString();

                commentItem.appendChild(document.createElement("br"));
                commentItem.appendChild(commentDate);

                commentsContainer.appendChild(commentItem);
            });
        }

        // SUBMIT COMMENT
        commentForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const commentText = commentInput.value.trim();

            if (!commentText) return;

            const { data: userData, error: userError } =
                await supabaseClient.auth.getUser();

            if (userError || !userData.user) {
                alert("Please log in to comment.");
                return;
            }

            commentButton.disabled = true;
            commentButton.textContent = "Posting...";

            const { error: commentError } = await supabaseClient
                .from("comments")
                .insert({
                    spot_id: spot.id,
                    user_id: userData.user.id,
                    content: commentText
                });

            if (commentError) {
                console.error("Comment error:", commentError.message);
                alert("Could not post comment: " + commentError.message);
            } else {
                commentInput.value = "";
                await loadComments();
            }

            commentButton.disabled = false;
            commentButton.textContent = "Post Comment";
        });

        // CREATE MAP MARKER
        const spotMarker = L.marker([
            spot.latitude,
            spot.longitude
        ])
            .bindPopup(popup)
            .on("popupopen", loadComments)
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


// =====================================
// SPOTZ USER PROFILE
// =====================================


// LOAD USER PROFILE AND THEIR SPOTS
async function loadProfile() {

    const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !userData.user) {
        return;
    }

    const user = userData.user;

    // GET PROFILE INFORMATION
    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Could not load profile:", error.message);
        return;
    }

    document.getElementById("profileUsername").textContent =
        profile?.username || user.user_metadata?.username || user.email;

    document.getElementById("profileBio").value =
        profile?.bio || "";

    const avatar = document.getElementById("profileAvatar");

    if (profile?.avatar_url) {
        avatar.src = profile.avatar_url;
    }

    // GET THIS USER'S SPOTS
    const { data: spots, error: spotsError } = await supabaseClient
        .from("spots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (spotsError) {
        console.error("Could not load user spots:", spotsError.message);
        document.getElementById("profileSpots").textContent =
            "Could not load your spots.";
        return;
    }

    // UPDATE SPOT COUNT
    document.getElementById("profileSpotCount").textContent =
        spots.length;

    // DISPLAY USER'S SPOTS
    const spotsContainer = document.getElementById("profileSpots");

    spotsContainer.replaceChildren();

    if (spots.length === 0) {
        spotsContainer.textContent =
            "You haven't shared any spots yet.";
    }

    spots.forEach(function(spot) {

        const spotCard = document.createElement("div");
        spotCard.className = "profile-spot-card";
        spotCard.style.cursor = "pointer";

spotCard.addEventListener("click", function() {
    openSpotPopup(spot);
});

        if (spot.photo_url) {
            const photo = document.createElement("img");
            photo.src = spot.photo_url;
            photo.alt = spot.title;
            photo.style.width = "100%";
            photo.style.maxWidth = "300px";
            photo.style.borderRadius = "10px";

            spotCard.appendChild(photo);
        }

        const title = document.createElement("h4");
        title.textContent = spot.title;
        spotCard.appendChild(title);

        const description = document.createElement("p");
        description.textContent = spot.description || "";
        spotCard.appendChild(description);

        const location = document.createElement("p");
        location.textContent = "📍 " + (spot.location_name || "");
        spotCard.appendChild(location);

        const category = document.createElement("p");
        category.textContent = spot.category || "";
        spotCard.appendChild(category);

        spotsContainer.appendChild(spotCard);
    });

    // COUNT LIKES RECEIVED ON THIS USER'S SPOTS
    if (spots.length > 0) {

        const spotIds = spots.map(spot => spot.id);

        const { data: likes, error: likesError } =
            await supabaseClient
                .from("likes")
                .select("spot_id")
                .in("spot_id", spotIds);

        if (likesError) {
            console.error("Could not load profile likes:", likesError.message);
            return;
        }

        document.getElementById("profileLikeCount").textContent =
            likes.length;

    } else {

        document.getElementById("profileLikeCount").textContent = "0";
    }
}


// SAVE USER PROFILE
document.getElementById("profileForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const { data: userData } =
            await supabaseClient.auth.getUser();

        if (!userData.user) {
            alert("Please log in first.");
            return;
        }

        const user = userData.user;

        const bio = document.getElementById("profileBio").value;


        // GET PROFILE PHOTO
        const photoFile =
            document.getElementById("profilePhoto").files[0];

        let avatarUrl = null;

        // UPLOAD PROFILE PHOTO IF SELECTED
        if (photoFile) {

            const fileExtension = photoFile.name.split(".").pop();

            const filePath =
                user.id + "/profile-" + Date.now() + "." + fileExtension;

            const { error: uploadError } = await supabaseClient
                .storage
                .from("profile-photos")
                .upload(filePath, photoFile, {
    upsert: false
});

            if (uploadError) {
                alert("Photo upload failed: " + uploadError.message);
                return;
            }

            const { data: publicUrlData } = supabaseClient
                .storage
                .from("profile-photos")
                .getPublicUrl(filePath);

            avatarUrl = publicUrlData.publicUrl;
        }


        // GET EXISTING USERNAME
        const { data: existingProfile, error: fetchError } =
            await supabaseClient
                .from("profiles")
                .select("username")
                .eq("id", user.id)
                .maybeSingle();

        if (fetchError) {
            alert("Could not load username: " + fetchError.message);
            return;
        }

        const username =
            existingProfile?.username ||
            user.user_metadata?.username ||
            user.email?.split("@")[0];

        if (!username) {
            alert("Could not find your username.");
            return;
        }

        // SAVE PROFILE
        
const profileUpdate = {
    bio: bio
};

if (avatarUrl) {
    profileUpdate.avatar_url = avatarUrl;
}

const { error } = await supabaseClient
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

        if (error) {
            console.error("Profile save error:", error.message);
            alert("Could not save profile: " + error.message);
            return;
        }

        document.getElementById("profileMessage").textContent =
            "Profile saved successfully!";

        await loadProfile();
    }
);


// LOAD PROFILE WHEN PAGE STARTS
loadProfile();

// CURRENT SPOT OPEN IN THE POPUP
let activeModalSpot = null;

// OPEN INDIVIDUAL SPOT POPUP
function openSpotPopup(spot) {

    const popup = document.getElementById("spotModal");

activeModalSpot = spot;

    // LOAD SPOT PHOTO
    const photo = document.getElementById("modalSpotPhoto");

    if (spot.photo_url) {
        photo.src = spot.photo_url;
        photo.style.display = "block";
    } else {
        photo.style.display = "none";
    }

    // LOAD SPOT INFORMATION
    document.getElementById("modalSpotTitle").textContent =
        spot.title || "Untitled Spot";

    document.getElementById("modalSpotLocation").textContent =
        "📍 " + (spot.location_name || "");

    document.getElementById("modalSpotCategory").textContent =
        spot.category || "";

    document.getElementById("modalSpotDescription").textContent =
        spot.description || "";

    // SHOW POPUP
    popup.hidden = false;
    loadModalLikes();
    loadModalComments();
}


// LOAD COMMENTS IN SPOT POPUP
async function loadModalComments() {

    if (!activeModalSpot) return;

    const spotId = activeModalSpot.id;
    const commentsList = document.getElementById("modalCommentsList");

    commentsList.textContent = "Loading comments...";

    // GET COMMENTS FOR THIS SPOT
    const { data: comments, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("spot_id", spotId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Could not load popup comments:", error.message);
        commentsList.textContent = "Could not load comments.";
        return;
    }

    commentsList.replaceChildren();

    if (comments.length === 0) {
        commentsList.textContent = "No comments yet. Be the first!";
        return;
    }

    // GET USERNAMES AND PROFILE PHOTOS
    const userIds = [...new Set(comments.map(comment => comment.user_id))];

    const { data: profiles, error: profileError } = await supabaseClient
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

    if (profileError) {
        console.error("Could not load comment profiles:", profileError.message);
    }

    // MATCH EACH COMMENT TO ITS USER PROFILE
    comments.forEach(function(comment) {

        const profile = profiles?.find(
            user => user.id === comment.user_id
        );

        const commentItem = document.createElement("div");
        commentItem.className = "modal-comment-item";

        const username = document.createElement("strong");
        username.textContent = profile?.username || "Spotz Member";
        username.style.cursor = "pointer";

username.addEventListener("click", function() {
    openPublicProfile(comment.user_id);
});

        const commentText = document.createElement("p");
        commentText.textContent = comment.content;

        commentItem.appendChild(username);

        // SHOW PROFILE PHOTO IF AVAILABLE
        if (profile?.avatar_url) {
            const avatar = document.createElement("img");
            avatar.src = profile.avatar_url;
            avatar.alt = "Profile picture";
            avatar.className = "comment-avatar";

            commentItem.prepend(avatar);
        }

        commentItem.appendChild(commentText);
        commentsList.appendChild(commentItem);

    });
}


// POST COMMENT FROM SPOT POPUP
async function handleModalComment(event) {

    event.preventDefault();

    if (!activeModalSpot) return;

    const { data: userData } = await supabaseClient.auth.getUser();

    if (!userData.user) {
        document.getElementById("modalCommentMessage").textContent =
            "Please log in to comment.";
        return;
    }

    const commentInput = document.getElementById("modalCommentInput");
    const commentMessage = document.getElementById("modalCommentMessage");

    const content = commentInput.value.trim();

    if (!content) return;

    commentMessage.textContent = "Posting comment...";

    const { error } = await supabaseClient
        .from("comments")
        .insert({
            spot_id: activeModalSpot.id,
            user_id: userData.user.id,
            content: content
        });

    if (error) {
        console.error("Could not post comment:", error.message);
        commentMessage.textContent = "Could not post comment. Please try again.";
        return;
    }

    commentInput.value = "";
    commentMessage.textContent = "Comment posted!";

    await loadModalComments();
}

// SET UP SPOT POPUP CLOSE BUTTON
function setupSpotModal() {

    const closeSpotModal = document.getElementById("closeSpotModal");
    const spotModal = document.getElementById("spotModal");

    const modalLikeButton = document.getElementById("modalLikeButton");
    const modalCommentForm = document.getElementById("modalCommentForm");

    if (!closeSpotModal || !spotModal) {
        console.error("Spot popup HTML elements not found.");
        return;
    }

    // POPUP LIKE BUTTON
    if (modalLikeButton) {
        modalLikeButton.addEventListener("click", handleModalLike);
    }

    // POPUP COMMENT FORM
    if (modalCommentForm) {
        modalCommentForm.addEventListener("submit", handleModalComment);
    }

    // CLOSE BUTTON
    closeSpotModal.addEventListener("click", function(event) {
        event.preventDefault();
        spotModal.hidden = true;
    });

    // CLICK OUTSIDE TO CLOSE
    spotModal.addEventListener("click", function(event) {
        if (event.target === spotModal) {
            spotModal.hidden = true;
        }
    });
}


// WAIT UNTIL HTML IS LOADED
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSpotModal);
} else {
    setupSpotModal();
}

// POPUP LIKE BUTTON
async function handleModalLike() {

    if (!activeModalSpot) return;

    const { data: userData } = await supabaseClient.auth.getUser();

    if (!userData.user) {
        alert("Please log in to like a Spot!");
        return;
    }

    const user = userData.user;
    const spotId = activeModalSpot.id;

    // CHECK IF USER ALREADY LIKED THIS SPOT
    const { data: existingLike, error: checkError } =
        await supabaseClient
            .from("likes")
            .select("*")
            .eq("spot_id", spotId)
            .eq("user_id", user.id)
            .maybeSingle();

    if (checkError) {
        console.error("Could not check like:", checkError.message);
        return;
    }

    if (existingLike) {

        // REMOVE LIKE
        const { error } = await supabaseClient
            .from("likes")
            .delete()
            .eq("spot_id", spotId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Could not remove like:", error.message);
            return;
        }

    } else {

        // ADD LIKE
        const { error } = await supabaseClient
            .from("likes")
            .insert({
                spot_id: spotId,
                user_id: user.id
            });

        if (error) {
            console.error("Could not add like:", error.message);
            return;
        }
    }

    // REFRESH LIKE DISPLAY
    await loadModalLikes();
}

// LOAD POPUP LIKES
async function loadModalLikes() {
   
    if (!activeModalSpot) return;

    const spotId = activeModalSpot.id;

    // GET ALL LIKES FOR THIS SPOT
    const { data: likes, error } = await supabaseClient
        .from("likes")
        .select("user_id")
        .eq("spot_id", spotId);

    if (error) {
        console.error("Could not load popup likes:", error.message);
        return;
    }

    // UPDATE LIKE COUNT
    document.getElementById("modalLikeCount").textContent =
        likes.length + (likes.length === 1 ? " like" : " likes");

    // CHECK IF CURRENT USER LIKED THIS SPOT
    const { data: userData } = await supabaseClient.auth.getUser();

    const userLiked = userData.user &&
        likes.some(like => like.user_id === userData.user.id);

    // UPDATE LIKE BUTTON
    const likeButton = document.getElementById("modalLikeButton");

    likeButton.textContent = userLiked ? "❤️ Liked" : "🤍 Like";
}


// OPEN ANOTHER USER'S PUBLIC PROFILE
async function openPublicProfile(userId) {

    const modal = document.getElementById("publicProfileModal");

    modal.hidden = false;

    document.getElementById("publicProfileUsername").textContent =
        "Loading profile...";

    document.getElementById("publicProfileBio").textContent = "";

    const avatar = document.getElementById("publicProfileAvatar");
    avatar.src = "";

    const spotsContainer = document.getElementById("publicProfileSpots");
    spotsContainer.textContent = "Loading spots...";

    // GET USER PROFILE
    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (profileError || !profile) {
        console.error("Could not load public profile:", profileError);
        document.getElementById("publicProfileUsername").textContent =
            "Profile not found";
        spotsContainer.textContent = "Could not load this profile.";
        return;
    }

    // DISPLAY PROFILE INFORMATION
    document.getElementById("publicProfileUsername").textContent =
        profile.username || "Spotz Member";

    document.getElementById("publicProfileBio").textContent =
        profile.bio || "No bio added yet.";

    if (profile.avatar_url) {
        avatar.src = profile.avatar_url;
    }

    // GET THIS USER'S SPOTS
    const { data: spots, error: spotsError } = await supabaseClient
        .from("spots")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (spotsError) {
        console.error("Could not load public spots:", spotsError.message);
        spotsContainer.textContent = "Could not load spots.";
        return;
    }

    spotsContainer.replaceChildren();

    if (spots.length === 0) {
        spotsContainer.textContent = "No shared spots yet.";
        return;
    }

    // DISPLAY EACH SPOT
    spots.forEach(function(spot) {

        const spotCard = document.createElement("div");
        spotCard.className = "profile-spot-card";
        spotCard.style.cursor = "pointer";

        spotCard.addEventListener("click", function() {
            modal.hidden = true;
            openSpotPopup(spot);
        });

        if (spot.photo_url) {
            const photo = document.createElement("img");
            photo.src = spot.photo_url;
            photo.alt = spot.title || "Spot photo";
            photo.style.width = "100%";
            photo.style.maxWidth = "300px";
            photo.style.borderRadius = "10px";
            spotCard.appendChild(photo);
        }

        const title = document.createElement("h4");
        title.textContent = spot.title || "Untitled Spot";
        spotCard.appendChild(title);

        const description = document.createElement("p");
        description.textContent = spot.description || "";
        spotCard.appendChild(description);

        const location = document.createElement("p");
        location.textContent = "📍 " + (spot.location_name || "");
        spotCard.appendChild(location);

        spotsContainer.appendChild(spotCard);
    });
}

// SET UP PUBLIC PROFILE POPUP
function setupPublicProfileModal() {

    const modal = document.getElementById("publicProfileModal");
    const closeButton = document.getElementById("closePublicProfile");

    if (!modal || !closeButton) {
        console.error("Public profile popup elements not found.");
        return;
    }

    // CLOSE BUTTON
    closeButton.addEventListener("click", function(event) {
        event.preventDefault();
        modal.hidden = true;
    });

    // CLICK OUTSIDE TO CLOSE
    modal.addEventListener("click", function(event) {
        if (event.target === modal) {
            modal.hidden = true;
        }
    });
}

// WAIT UNTIL HTML IS LOADED
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPublicProfileModal);
} else {
    setupPublicProfileModal();
}
