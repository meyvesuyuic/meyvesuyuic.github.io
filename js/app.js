// Supabase'i ES Module olarak içe aktarıyoruz
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { districtsMap } from './turkey-cities.js';

const SUPABASE_URL = 'https://qryjfafoimjcwcuruzah.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mYbPrK4EDrlByE_ziop0Ug_nY_wjwaz';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');

const userContainer = document.getElementById('userContainer');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');

// Profil Modalı Elemanları
const profileTrigger = document.getElementById('profileTrigger');
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const profileModalOverlay = document.getElementById('profileModalOverlay');
const logoutBtnModal = document.getElementById('logoutBtnModal');

const profileAvatarLarge = document.getElementById('profileAvatarLarge');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileNickname = document.getElementById('profileNickname');
const prefLocations = document.getElementById('prefLocations');
const prefBeerStyles = document.getElementById('prefBeerStyles');
const prefOtherAlcohols = document.getElementById('prefOtherAlcohols');
const prefFrequency = document.getElementById('prefFrequency');
const prefEnvironment = document.getElementById('prefEnvironment');
const prefAbv = document.getElementById('prefAbv');
const prefSnack = document.getElementById('prefSnack');
const twitterProfileLink = document.getElementById('twitterProfileLink');
const profileActionWrapper = document.getElementById('profileActionWrapper');

// 1. Giriş Butonu İşlevi
loginBtn.addEventListener('click', async () => {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'twitter',
		options: {
			redirectTo: window.location.origin
		}
	});

	if (error) console.error("Giriş başlatılamadı:", error.message);
});

// 2. Çıkış Butonu İşlevi
logoutBtn.addEventListener('click', async () => {
	const user = (await supabase.auth.getUser()).data.user;
	if (user) {
		localStorage.removeItem(`user_profile_${user.id}`);
		localStorage.removeItem(`user_profile_fetched_at_${user.id}`);
	}
	const { error } = await supabase.auth.signOut();
	if (error) {
		console.error("Çıkış yapılamadı:", error.message);
	} else {
		userContainer.style.display = 'none';
		loginBtn.style.display = 'flex';
	}
});

// 3. Oturum Durumunu Dinleme
supabase.auth.onAuthStateChange(async (event, session) => {
	// Arayüz yükleme kilidini (preload sınıflarını) kaldırıyoruz
	document.documentElement.classList.remove('preload-session-active', 'preload-profile-ready', 'preload-needs-onboarding', 'preload-logged-out');

	if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
		if (!session) {
			loginBtn.style.display = 'flex';
			userContainer.style.display = 'none';
			document.getElementById('setupScreen').style.display = 'none';
			clearMap();
			return;
		}

		const user = session.user;
		// Profil açma tetikleyicisi
		if (profileTrigger) {
			profileTrigger.onclick = () => {
				openProfileModal(user);
			};
		}
		const localKey = `user_profile_${user.id}`;
		const cacheTimeKey = `user_profile_fetched_at_${user.id}`;
		const cachedProfile = localStorage.getItem(localKey);
		const cachedTime = localStorage.getItem(cacheTimeKey);
		const now = Date.now();

		if (cachedProfile && cachedTime && (now - parseInt(cachedTime, 10) < 60 * 60 * 1000)) {
			try {
				const profileData = JSON.parse(cachedProfile);
				if (profileData.is_onboarded) {
					console.log("Kullanıcı bilgileri lokal depolamadan yüklendi (Onboarded), DB sorgusu atlanıyor:", profileData);
					userName.innerText = profileData.display_name;
					userAvatar.src = profileData.avatar_url;
					loginBtn.style.display = 'none';
					userContainer.style.display = 'flex';
					document.getElementById('setupScreen').style.display = 'none';
					initMap();
					loadMapData();
					return;
				}
			} catch (e) {
				console.error("Lokal profil verisi parse edilemedi.", e);
			}
		}

		// Supabase'den güncel profil durumunu çekelim
		const { data: dbProfile, error: dbError } = await supabase
			.from('profiles')
			.select('is_onboarded, display_name, nickname, avatar_url, bio, favorite_styles, other_alcohols, preferred_locations, drinking_frequency, drinking_environment, abv_preference, drinking_snack')
			.eq('id', user.id)
			.maybeSingle();

		if (dbProfile && dbProfile.is_onboarded) {
			console.log("Kullanıcı onboard edilmiş, bilgiler yerel depolamaya yazılıyor.");
			localStorage.setItem(localKey, JSON.stringify(dbProfile));
			localStorage.setItem(cacheTimeKey, Date.now().toString());

			userName.innerText = dbProfile.display_name;
			userAvatar.src = dbProfile.avatar_url;
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex';
			document.getElementById('setupScreen').style.display = 'none';
			initMap();
			loadMapData();
		} else {
			// Onboard edilmemiş veya kaydı yok!
			console.log("Kullanıcı kurulum ekranını tamamlamamış. Setup ekranı açılıyor.");
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex'; // Profil bilgilerinin görünmesi için
			document.getElementById('setupScreen').style.display = 'flex';
			clearMap();

			const metadata = user.user_metadata;
			let betterAvatar = metadata.avatar_url ? metadata.avatar_url.replace('_normal', '_400x400') : '';
			const twitterData = {
				id: user.id,
				twitter_id: metadata.provider_id || metadata.sub,
				nickname: metadata.preferred_username || metadata.user_name,
				display_name: metadata.name || metadata.full_name,
				avatar_url: betterAvatar,
				is_onboarded: false,
				updated_at: new Date().toISOString()
			};

			// Profil bilgilerini hemen arayüze bas
			userName.innerText = twitterData.display_name;
			userAvatar.src = twitterData.avatar_url;

			if (!dbProfile) {
				// İlk defa geliyorsa profili default değerlerle oluşturalım
				await supabase.from('profiles').upsert(twitterData, { onConflict: 'id' });
			}

			// Setup sihirbazını başlatıyoruz
			initSetupLogic(user, twitterData);
		}
	} else if (event === 'SIGNED_OUT') {
		loginBtn.style.display = 'flex';
		userContainer.style.display = 'none';
		document.getElementById('setupScreen').style.display = 'none';
		clearMap();
		userName.innerText = '';
		userAvatar.src = '';
	}
});
let isSetupInitialized = false;

// Setup mantığını yöneten sihirbaz fonksiyonu
function initSetupLogic(user, twitterData) {
	if (isSetupInitialized) return;
	isSetupInitialized = true;

	let selectedBeerStyles = [];
	let selectedOtherAlcohols = [];
	let selectedLocations = [];

	const step1 = document.getElementById('step-1');
	const step2 = document.getElementById('step-2');
	const nextBtnStep1 = document.getElementById('nextBtnStep1');
	const saveProfileBtn = document.getElementById('saveProfileBtn');

	// Konum Seçim DOM Elemanları
	const citySelect = document.getElementById('citySelect');
	const districtSelect = document.getElementById('districtSelect');
	const addLocationBtn = document.getElementById('addLocationBtn');
	const selectedLocationsGroup = document.getElementById('selectedLocationsGroup');

	// Şehirleri dropdown listesine dinamik olarak doldur (81 il)
	if (citySelect) {
		citySelect.innerHTML = '<option value="" disabled selected>Şehir Seçin</option>';
		// İstanbul, Ankara, İzmir, Eskişehir'i başa alıp diğer şehirleri alfabetik sıralayalım
		const priorityCities = ["İstanbul", "Ankara", "İzmir", "Eskişehir"];
		const otherCities = Object.keys(districtsMap)
			.filter(c => !priorityCities.includes(c))
			.sort((a, b) => a.localeCompare(b, 'tr'));
		const sortedCities = [...priorityCities, ...otherCities];

		sortedCities.forEach(city => {
			const opt = document.createElement('option');
			opt.value = city;
			opt.innerText = city;
			citySelect.appendChild(opt);
		});
	}

	// Åehir seÃ§ildiÄŸinde ilÃ§eleri doldur
	if (citySelect && districtSelect) {
		citySelect.addEventListener('change', () => {
			const city = citySelect.value;
			districtSelect.innerHTML = '<option value="" disabled selected>İlçe Seçin</option>';

			if (districtsMap[city]) {
				// BÃ¼tÃ¼n Åehir seÃ§eneÄŸini ilÃ§e listesinin baÅŸÄ±na ekle
				const allOpt = document.createElement('option');
				allOpt.value = "Bütün Şehir";
				allOpt.innerText = "Bütün Şehir";
				districtSelect.appendChild(allOpt);

				districtsMap[city].forEach(district => {
					const opt = document.createElement('option');
					opt.value = district;
					opt.innerText = district;
					districtSelect.appendChild(opt);
				});
				districtSelect.disabled = false;
			} else {
				districtSelect.disabled = true;
			}
		});
	}

	// Konum ekleme butonu tetikleyicisi
	if (addLocationBtn) {
		addLocationBtn.addEventListener('click', () => {
			const city = citySelect ? citySelect.value : '';
			const district = districtSelect ? districtSelect.value : '';

			if (!city || !district) {
				alert("Lütfen önce şehir ve ilçe seçiniz.");
				return;
			}

			const locStr = `${city}, ${district}`;
			if (selectedLocations.includes(locStr)) {
				alert("Bu konum zaten eklenmiş.");
				return;
			}

			if (selectedLocations.length >= 3) {
				alert("En fazla 3 adet konum ekleyebilirsiniz.");
				return;
			}

			selectedLocations.push(locStr);
			renderLocations();

			// İlçe seçimini sıfırla
			if (districtSelect) {
				districtSelect.value = '';
			}
		});
	}

	// Seçilen konumları ekrana çizdir
	function renderLocations() {
		if (!selectedLocationsGroup) return;
		selectedLocationsGroup.innerHTML = '';

		selectedLocations.forEach((loc, index) => {
			const pill = document.createElement('div');
			pill.className = 'location-pill';
			pill.innerHTML = `
				<span>${loc}</span>
				<button type="button" class="location-pill-delete" data-index="${index}">&times;</button>
			`;

			pill.querySelector('.location-pill-delete').addEventListener('click', (e) => {
				const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
				selectedLocations.splice(idx, 1);
				renderLocations();
			});

			selectedLocationsGroup.appendChild(pill);
		});
	}

	// Tekli seçim değerini al
	function getPillValue(groupId) {
		const selected = document.querySelector(`#${groupId} .pill-btn.selected`);
		return selected ? selected.getAttribute('data-value') : null;
	}

	// Pill grubu tıklamalarını yönet
	function initPillGroup(groupId, isMultiSelect = false) {
		const group = document.getElementById(groupId);
		if (!group) return;

		const pills = group.querySelectorAll('.pill-btn');
		pills.forEach(pill => {
			// Mevcut olay dinleyicilerini sıfırlamak için butonu kopyalıyoruz
			const newPill = pill.cloneNode(true);
			pill.parentNode.replaceChild(newPill, pill);

			newPill.addEventListener('click', () => {
				const val = newPill.getAttribute('data-value');
				if (isMultiSelect) {
					if (newPill.classList.contains('selected')) {
						newPill.classList.remove('selected');
						if (groupId === 'beerStylesGroup') {
							selectedBeerStyles = selectedBeerStyles.filter(s => s !== val);
						} else if (groupId === 'otherAlcoholsGroup') {
							selectedOtherAlcohols = selectedOtherAlcohols.filter(s => s !== val);
						}
					} else {
						newPill.classList.add('selected');
						if (groupId === 'beerStylesGroup') {
							selectedBeerStyles.push(val);
						} else if (groupId === 'otherAlcoholsGroup') {
							selectedOtherAlcohols.push(val);
						}
					}
				} else {
					const groupPills = group.querySelectorAll('.pill-btn');
					groupPills.forEach(p => p.classList.remove('selected'));
					newPill.classList.add('selected');
				}
			});
		});
	}

	// Tüm seçim gruplarını başlat
	initPillGroup('beerStylesGroup', true);
	initPillGroup('otherAlcoholsGroup', true);
	initPillGroup('frequencyGroup', false);
	initPillGroup('environmentGroup', false);
	initPillGroup('abvGroup', false);
	initPillGroup('snackGroup', false);

	// İlerleme çubuğunu güncelle
	function updateProgress(step) {
		const bar = document.getElementById('setupProgressBar');
		if (bar) bar.style.width = (step === 1 ? '50%' : '100%');
	}

	// Biyografi karakter sayacı
	const bioInput = document.getElementById('bioInput');
	const bioCharCount = document.getElementById('bioCharCount');
	if (bioInput && bioCharCount) {
		bioInput.addEventListener('input', () => {
			const currentLength = bioInput.value.length;
			bioCharCount.innerText = `${currentLength}/100`;
			if (currentLength >= 100) {
				bioCharCount.style.color = 'var(--accent-color)';
			} else {
				bioCharCount.style.color = '#a8a29e';
			}
		});
	}

	updateProgress(1);

	// Adım 1 Doğrulama ve Geçiş
	nextBtnStep1.onclick = () => {
		if (selectedLocations.length === 0) {
			alert("Lütfen en az 1 tercih edilen konum ekleyiniz.");
			return;
		}
		if (selectedBeerStyles.length === 0) {
			alert("Lütfen en az 1 favori bira tarzı seçiniz.");
			return;
		}
		if (selectedOtherAlcohols.length === 0) {
			alert("Lütfen diğer alkol tercihlerinizi seçiniz.");
			return;
		}
		// Adım 2'ye geçiş yap
		step1.classList.remove('active');
		step2.classList.add('active');
		updateProgress(2);
		window.scrollTo(0, 0);
	};

	// Adım 2 Doğrulama ve Kaydetme
	saveProfileBtn.onclick = async () => {
		const bioInput = document.getElementById('bioInput');
		const rawBio = bioInput ? bioInput.value : '';
		const sanitizedBio = rawBio.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim().substring(0, 100);

		const environment = getPillValue('environmentGroup');
		if (!environment) {
			alert("Lütfen tercih ettiğiniz içim ortamını seçiniz.");
			return;
		}
		const abv = getPillValue('abvGroup');
		if (!abv) {
			alert("Lütfen tercih ettiğiniz alkol oranını (ABV) seçiniz.");
			return;
		}
		const snack = getPillValue('snackGroup');
		if (!snack) {
			alert("Lütfen biranın yanındaki atıştırmalık tercihinizi seçiniz.");
			return;
		}
		const frequency = getPillValue('frequencyGroup');
		if (!frequency) {
			alert("Lütfen bira içme sıklığınızı seçiniz.");
			return;
		}

		// Supabase profiles tablosunu güncelle
		const updateData = {
			is_onboarded: true,
			bio: sanitizedBio,
			favorite_styles: selectedBeerStyles,
			other_alcohols: selectedOtherAlcohols,
			preferred_locations: selectedLocations,
			drinking_frequency: frequency,
			drinking_environment: environment,
			abv_preference: abv,
			drinking_snack: snack,
			updated_at: new Date().toISOString()
		};

		const { error } = await supabase
			.from('profiles')
			.update(updateData)
			.eq('id', user.id);

		if (error) {
			alert("Profil kurulumu tamamlanırken bir hata oluştu: " + error.message);
		} else {
			console.log("Kurulum başarıyla tamamlandı.");

			// Yerel önbelleğe kaydet
			const localKey = `user_profile_${user.id}`;
			const localData = {
				display_name: twitterData.display_name,
				nickname: twitterData.nickname,
				avatar_url: twitterData.avatar_url,
				bio: sanitizedBio,
				is_onboarded: true,
				favorite_styles: selectedBeerStyles,
				other_alcohols: selectedOtherAlcohols,
				preferred_locations: selectedLocations,
				drinking_frequency: getPillValue('frequencyGroup'),
				drinking_environment: environment,
				abv_preference: abv,
				drinking_snack: snack
			};
			localStorage.setItem(localKey, JSON.stringify(localData));

			// Arayüzü güncelle
			userName.innerText = twitterData.display_name;
			userAvatar.src = twitterData.avatar_url;
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex';
			document.getElementById('setupScreen').style.display = 'none';
			initMap();
			// Clear map cache keys to ensure the new user's location is rendered immediately
			localStorage.removeItem(MAP_CACHE_KEY);
			localStorage.removeItem(MAP_CACHE_TIME_KEY);
			// Refresh map with the new user
			loadMapData();
		}
	};
}

// Profil modalını açma
async function openProfileModal(user) {
	if (!user) return;

	let session = null;
	try {
		const sessionResult = await supabase.auth.getSession();
		session = sessionResult.data.session;
	} catch (e) {
		console.error("Session check failed in openProfileModal:", e);
	}
	const isCurrentUser = session && session.user && session.user.id === user.id;

	const localKey = `user_profile_${user.id}`;
	const cacheTimeKey = `user_profile_fetched_at_${user.id}`;
	let profileData = null;

	if (isCurrentUser) {
		const cachedProfile = localStorage.getItem(localKey);
		const cachedTime = localStorage.getItem(cacheTimeKey);
		const now = Date.now();
		if (cachedProfile && cachedTime && (now - parseInt(cachedTime, 10) < 60 * 60 * 1000)) {
			try {
				profileData = JSON.parse(cachedProfile);
			} catch (e) { }
		}
	}

	// Eğer önbellek eksikse veya başka bir kullanıcının profili ise veritabanından çekelim (her zaman güncel veri için)
	if (!profileData || !profileData.favorite_styles) {
		const tableName = isCurrentUser ? 'profiles' : 'public_profiles';
		const { data, error } = await supabase
			.from(tableName)
			.select('is_onboarded, display_name, nickname, avatar_url, bio, favorite_styles, other_alcohols, preferred_locations, drinking_frequency, drinking_environment, abv_preference, drinking_snack')
			.eq('id', user.id)
			.maybeSingle();

		if (!error && data) {
			profileData = data;
			if (isCurrentUser) {
				localStorage.setItem(localKey, JSON.stringify(data));
				localStorage.setItem(cacheTimeKey, Date.now().toString());
			}
		}
	}

	if (!profileData) return;

	// Bilgileri yerleştir
	profileAvatarLarge.src = profileData.avatar_url || '';
	profileDisplayName.innerText = profileData.display_name || '';
	profileNickname.innerText = profileData.nickname ? `@${profileData.nickname}` : '';

	const profileBio = document.getElementById('profileBio');
	if (profileBio) {
		profileBio.innerText = profileData.bio || '';
		profileBio.style.display = profileData.bio ? 'block' : 'none';
	}

	// Twitter profil butonu ayarı
	if (twitterProfileLink && profileActionWrapper) {
		if (profileData.nickname) {
			profileActionWrapper.style.display = 'block';
			twitterProfileLink.onclick = (e) => {
				e.preventDefault();
				const nickname = profileData.nickname;
				const twitterUrl = `https://x.com/${nickname}`;
				const twitterAppUrl = `twitter://user?screen_name=${nickname}`;

				const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
				if (isMobile) {
					const start = Date.now();
					window.location.href = twitterAppUrl;

					setTimeout(() => {
						if (Date.now() - start < 2000) {
							window.open(twitterUrl, '_blank');
						}
					}, 1500);
				} else {
					window.open(twitterUrl, '_blank');
				}
			};
		} else {
			profileActionWrapper.style.display = 'none';
		}
	}

	// Konumlar
	prefLocations.innerHTML = '';
	if (profileData.preferred_locations && profileData.preferred_locations.length > 0) {
		profileData.preferred_locations.forEach(loc => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = loc;
			prefLocations.appendChild(span);
		});
	} else {
		prefLocations.innerHTML = '<span class="pref-tag">Belirtilmemiş</span>';
	}

	// Bira Tarzları
	prefBeerStyles.innerHTML = '';
	if (profileData.favorite_styles && profileData.favorite_styles.length > 0) {
		profileData.favorite_styles.forEach(style => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = style;
			prefBeerStyles.appendChild(span);
		});
	} else {
		prefBeerStyles.innerHTML = '<span class="pref-tag">Belirtilmemiş</span>';
	}

	// Diğer Alkoller
	prefOtherAlcohols.innerHTML = '';

	const alcoholColors = {
		"Rakı": { bg: "#e0f2fe", border: "#0ea5e9", color: "#0369a1" },
		"Şarap": { bg: "#ffe4e6", border: "#f43f5e", color: "#be185d" },
		"Viski": { bg: "#fef3c7", border: "#f59e0b", color: "#b45309" },
		"Cin": { bg: "#d1fae5", border: "#10b981", color: "#047857" },
		"Votka": { bg: "#f1f5f9", border: "#64748b", color: "#475569" },
		"Tekila": { bg: "#fef9c3", border: "#eab308", color: "#a16207" },
		"Kokteyl": { bg: "#f3e8ff", border: "#a855f7", color: "#6d28d9" },
		"İçmiyorum": { bg: "#f5f5f4", border: "#78716c", color: "#57504b" }
	};

	if (profileData.other_alcohols && profileData.other_alcohols.length > 0) {
		profileData.other_alcohols.forEach(alc => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = alc;

			// Her alkol seçeneği için pastel renk setini uygula
			if (alcoholColors[alc]) {
				span.style.backgroundColor = alcoholColors[alc].bg;
				span.style.borderColor = alcoholColors[alc].border;
				span.style.color = alcoholColors[alc].color;
				span.style.fontWeight = '600';
			}

			prefOtherAlcohols.appendChild(span);
		});
	} else {
		prefOtherAlcohols.innerHTML = '<span class="pref-tag">Belirtilmemiş</span>';
	}

	// Tekli seçim değerleri
	prefFrequency.innerText = profileData.drinking_frequency || '-';
	prefEnvironment.innerText = profileData.drinking_environment || '-';
	prefAbv.innerText = profileData.abv_preference || '-';
	prefSnack.innerText = profileData.drinking_snack || '-';

	// Oturumu Kapat Butonu görünürlüğü (Sadece kendi profilinde göster)
	if (logoutBtnModal) {
		logoutBtnModal.style.display = isCurrentUser ? 'block' : 'none';
	}

	// Modalı göster
	document.body.style.overflow = 'hidden';
	profileModal.style.display = 'flex';
	setTimeout(() => {
		profileModal.classList.add('active');
	}, 10);
}

// Profil modalını kapatma
function closeProfileModal() {
	profileModal.classList.remove('active');
	setTimeout(() => {
		profileModal.style.display = 'none';
		document.body.style.overflow = '';
	}, 350);
}

// Olay dinleyicilerini bağlayalım
if (closeProfileBtn) {
	closeProfileBtn.addEventListener('click', closeProfileModal);
}
if (profileModalOverlay) {
	profileModalOverlay.addEventListener('click', closeProfileModal);
}
if (logoutBtnModal) {
	logoutBtnModal.addEventListener('click', () => {
		closeProfileModal();
		logoutBtn.click();
	});
}
// Fire Effect Particles Generation
document.addEventListener('DOMContentLoaded', () => {
	const fireContainer = document.getElementById('fire');
	if (fireContainer) {
		const parts = 90;
		for (let i = 0; i < parts; i++) {
			const particle = document.createElement('div');
			particle.className = 'particle';
			// Random delay to make the fire look natural and staggered
			particle.style.setProperty('--delay', (Math.random() * 1.2) + 's');
			// Generate random particle size (between 1.5em and 3.5em)
			const size = (1.5 + Math.random() * 2) + 'em';
			particle.style.setProperty('--size', size);
			// Position the particle horizontally with an even distribution
			particle.style.setProperty('--left', `calc((100% - ${size}) * ${i / parts})`);
			fireContainer.appendChild(particle);
		}
	}
});

// --- Map Integration for Istanbul, Ankara, Izmir, Eskisehir ---

const CITIES = [
	{
		id: 'istanbul',
		name: 'İstanbul',
		exploreSuffix: "'u İncele",
		viewBox: '119.881 34.497 106.166 64.114',
		viewBoxObj: { x: 119.881, y: 34.497, w: 106.166, h: 64.114 },
		path: '<path d="M187.613,66.733l-2.876,1.342l-2.063,2.218l0.561,1.719l0.062,0.188l-0.125,0.188l-2.002,3.78 l-0.031,0.062l-0.062,0.062l-1.657,1.78l-0.564,3l1.593,1.595l0.031,0.031l2.093,2.47l0.031,0.031l2.249,2.282l0.062,0.031 l3.499,1.877l0.156,0.094l0.062,0.156l1.03,2.439l3.593,1.533l1.376-2.53l0.031-0.094l1.221-3.937l0.657-2.156l0.031-0.188 l0.188-0.094l3.657-2.154h0.031l2.626-1.405l0.188-0.062l0.188,0.031l1.625,0.376l0.094,0.031l0.062,0.031l3.593,2.158 l2.219-0.53l3.032-1.529h0.031l2.595-1.249h0.031l3.689-2.123l0.627-2.875c-0.638-0.155-3.737-0.913-4.593-1.159 c-0.842-0.24-4.405-1.127-4.405-1.127l-7.437-1.629l-0.031-0.031h-0.031l-5.561-1.878v-0.031h-0.031l-5.624-2.347L187.613,66.733 z"></path><path d="M179.76,85.166l-0.062,0.688l-0.094,0.75l1.688,0.751l0.062,0.031l0.062,0.031l2.155,1.907l0.188,0.156 l-0.031,0.25l-0.252,2.906l-0.031,0.562l-0.562-0.094l-2-0.376l-0.156-0.031l-0.095-0.092l-1.374-1.282l-0.062-0.031 l-0.031-0.031l-1.374-1.907l-0.031-0.062l-0.031-0.062l-1.029-2.907l-0.188-0.531l0.594-0.125l2-0.374L179.76,85.166z"></path><path d="M136.272,39.497l-0.25,0.25l0.031,0.344l-0.344,0.031l-1.658,3.155l1.873,3.532l0.125,0.219l-0.125,0.25 l-2.408,4.53v0.031l-3.284,5.904v0.031l-4.098,6.686v0.031l-1.253,5.249l1.092,3.563l4.689-1.372h0.031h0.031l6.594-0.902h0.125 l0.125,0.031l2.874,1.158v-0.031c0,0,1.118,0.405,2.312,0.782c0.597,0.189,1.23,0.361,1.719,0.501 c0.245,0.07,0.433,0.118,0.594,0.156c0.161,0.039,0.312,0.062,0.25,0.062c0.178,0,0.291,0.05,0.438,0.094s0.321,0.088,0.5,0.156 c0.358,0.136,0.757,0.324,1.156,0.501c0.798,0.351,1.531,0.689,1.531,0.689l0.062,0.031l0.031,0.031l3.499,2.596v-0.062v-0.469 l0.469-0.031l2.656-0.124h0.406l0.094,0.406c0,0,0.122,0.564,0.249,1.219c0.105,0.539,0.182,1.038,0.218,1.469 c0.028,0.008,0.025,0.023,0.062,0.031c0.213,0.045,0.573,0.093,1,0.126c0.854,0.063,1.994,0.087,3.156,0.096 c2.325,0.017,4.656-0.059,4.656-0.059h0.219l0.125,0.125l0.781,0.656l1.312-0.718l0.094-0.031l0.094-0.031l3.188-0.248 l2.157-1.124l-0.594-0.344l-0.312-0.156l0.031-0.312l0.251-2.281l0.062-0.438h0.438l1.656,0.001h0.281l0.125,0.219l0.874,1.344 l1.782-1.249l0.626-2.719v-0.094l0.062-0.094l0.5-0.688l-0.687-2.281l-0.125-0.344l0.344-0.219l1.219-0.749l0.031-0.031 l1.439-2.03l0.062-0.094l0.532-1.219l-3.906-0.002h-0.094l-0.062-0.031l-4.311-1.502l-0.031-0.031h-0.031l-4.53-2.283 l-4.687-2.409l-5.436-2.784h-0.031l-5.529-3.534l-5.81-3.409l-0.031-0.031l-3.405-2.408h-0.031l-4.529-3.408l-0.031-0.031 l-0.031-0.031l-2.779-2.783L136.71,40.5l-0.031-0.062L136.272,39.497z"></path>',
		center: { x: 170, y: 67 },
		radius: 22
	},
	{
		id: 'ankara',
		name: 'Ankara',
		exploreSuffix: "'yı İncele",
		viewBox: '261.9829999999999 107.635 164.271 146.084',
		viewBoxObj: { x: 261.983, y: 107.635, w: 164.271, h: 146.084 },
		path: '<path d="M349.776,112.635l-0.47,0.969l-0.062,0.125l-0.125,0.062l-1.939,1.187 c-0.027,0.051-0.064,0.094-0.094,0.188c-0.017,0.052-0.029,0.072-0.031,0.094c0.143,0.115,0.289,0.261,0.5,0.469 c0.238,0.234,0.543,0.507,0.812,0.781c0.538,0.55,1.03,1.063,1.03,1.063l0.094,0.125l0.031,0.125l0.437,2.156l0.062,0.375 l-0.344,0.156l-2.439,1.218l-0.062,0.031l-3.939,2.748h-0.031l-2.689,1.624h-0.031l-6.314,3.028c0,0-0.03,0.031-0.031,0.031 c-0.034,0.019-0.626,0.327-1.281,0.687c-0.337,0.185-0.677,0.381-0.969,0.53c-0.146,0.075-0.262,0.135-0.375,0.188 s-0.182,0.092-0.312,0.125c0.058-0.015-0.245,0.115-0.531,0.25s-0.656,0.297-1,0.468c-0.688,0.344-1.312,0.687-1.312,0.687 l-3.157,2.342v0.031h-0.031l-1.876,1.249l-0.125,0.094h-0.125c0,0-6.978-0.004-7.781-0.004c-0.198,0-1.069,0.195-1.781,0.437 c-0.678,0.229-1.226,0.446-1.281,0.468l-0.062,0.031l-1.813,0.968l-0.125,0.031h-0.125l-5.719-0.065h-0.094l-0.094-0.062 l-3.561-1.596l-0.125-0.062l-0.062-0.062l-1.343-1.532l-1.094-0.782l-3.625,0.404h-0.031l-3,0.529l-0.156,0.031l-0.159-0.066 l-2.03-1.157l-0.031-0.031l-2.843-1.314l-2.03-1.001l-1.344,0.124l-0.907,1.874l-0.031,0.062v0.031l-1.064,4.03v0.094l-0.062,0.062 l-1.501,2.218l-0.031,0.031l-0.031,0.031l-1.532,1.624l-0.094,0.125l-0.188,0.031l-3.531,0.404l-0.125,0.031l-2.345,1.03h-0.031 l-2.657,1.311l-1.625,0.843l1.248,3.563v0.031h0.031l0.499,2.031c0.063,0.07,0.213,0.233,0.5,0.469 c0.342,0.282,0.787,0.531,1,0.532c0.713,0,1.241,0.454,1.656,0.845c0.285,0.268,0.387,0.39,0.5,0.531 c0.169-0.003,1.266-0.005,2.5-0.468c1.386-0.519,1.703-0.886,2.532-1.093c0.319-0.08,0.889-0.246,1.438-0.405 c0.549-0.16,1.08-0.311,1.562-0.311c0.324,0,0.706,0.1,1.25,0.22c0.544,0.119,1.185,0.282,1.812,0.439 c1.206,0.302,2.225,0.571,2.312,0.595l5.595-1.216l0.125-0.031l0.125,0.031l6.249,1.972l5.405,1.941h0.031l6.562,0.192h0.25 l0.156,0.219l2.31,3.376l0.031,0.031l0.031,0.062l2.059,5.001c0.125,0.063,0.818,0.409,1.75,0.907 c1.011,0.54,2.082,1.13,2.624,1.563c0.861,0.689,2.655,1.97,2.655,1.97l0.562,0.375l-0.531,0.406l-4.314,3.467l3.372,5.908v0.031 l2.154,4.47v0.031l2.309,5.876l0.031,0.031v0.031l1.435,5.001l0.031,0.125l-0.031,0.156l-1.597,5.218l0.842,3.125l2.405,2.407 l0.156,0.156l-0.031,0.25l-0.345,2.688l-0.031,0.25l-0.216,0.127l-4.313,2.31v0.031h-0.031l-4.532,1.936l-3.128,3.905l3.593,2.252 l0.125,0.062l0.062,0.125l1.748,3.532l1.623,3.063l4.438,0.471l4.657-1.966l0.094-0.062h0.094l4.312,0.002h0.125l0.094,0.062 l5.467,2.753l0.094,0.031l4.593,1.441l7.282-2.434l4.972-4.716l0.094-0.094l0.125-0.031l3.345-0.936l3.908-4.342l1.002-2.968 l0.125-0.438l0.438,0.094l3.969,0.69l2.096-3.249l0.219-0.375l0.406,0.188l5.311,2.534l0.031,0.031l0.062,0.031l9.371,7.693 l1.563-1.405v-0.031l1.063-1.749l0.188-0.344l0.375,0.125l2.344,0.72l0.281,0.094l0.062,0.312l0.155,1.031l1.937,1.313l0.094,0.031 l0.062,0.094l2.498,3.751l0.031,0.062v0.031l1.092,2.876l0.031,0.125l-0.031,0.156l-0.877,3.75l-0.031,0.125l-0.125,0.125 l-0.906,0.906l0.341,5.281l1.968,2.532l1.812,0.876l0.596-3.438l0.125-0.688l0.594,0.344l2.311,1.251l0.094,0.031l0.062,0.094 l2.498,3.22l0.062,0.062l0.031,0.062l0.874,2.312l0.062,0.156l-0.031,0.125l-0.501,2.312l1.655,2.313l0.062,0.062l0.75-0.469 l1.752-3.624l1.94-4.093v-0.031l0.47-2.625l-0.937-2.719l-2.624-2.657l-0.312-0.312l0.25-0.344l2.346-3.03l0.063-0.086l0.094-0.062 l4.563-2.467l0.625-0.938l-4.249-1.752l-0.062-0.031h-0.031l-2.155-1.439l-0.031-0.031l-0.062-0.062l-3.092-3.471h-0.031 l-3.874-2.314l-0.094-0.062l-0.031-0.062l-3.217-3.752l-0.031-0.031l-0.031-0.031l-1.904-3.282l-2.061-1.563l-0.219-0.156v-0.25 l0.002-3.719l-1.968-1.813l-0.094-0.062l-0.033-0.129l-0.905-2.5l-0.031-0.125l0.031-0.156l0.846-3.969l-0.655-2.781l-3.561-2.377 l-0.094-0.062l-0.062-0.094l-0.999-1.689l-0.062-0.094l-1.874-1.876l-0.156-0.156v-0.188l0.001-2.312v-0.188l0.094-0.125 l2.971-4.186l0.501-2.156l0.378-6.25v-0.094l0.031-0.094l1.439-2.687l0.847-4.844l0.062-0.406l0.406-0.031l6.094-0.341l4.158-3.123 h0.031h0.031l1.907-1.187l-1.218-2.47l-0.031-0.062v-0.094l-0.529-3.562l-0.031-0.031v-0.031l0.002-3.594v-0.125l0.094-0.125 l2.658-4.28l2.722-4.624l-4.407-1.438h-0.031l-0.031-0.031l-3.624-1.908l-4.624-1.066h-0.031l-4.344,0.186l-1.876,1.905 l-0.689,2.031l-0.094,0.281l-0.281,0.062l-1.969,0.343l-0.25,0.031l-0.188-0.156l-3.217-3.033v-0.031l-2.687-2.657l-0.062-0.062 l-0.031-0.062l-1.061-1.97l-0.062-0.094v-0.094l-0.155-2.625l-4.779-2.878l-0.031-0.031l-0.031-0.031l-1.624-1.439l-0.125-0.125 l-0.031-0.188l-0.343-2.656l-0.031-0.219l0.094-0.156l1.657-2.343l-2.906-0.346h-0.062l-0.031-0.031l-2.5-0.876l-0.031-0.031 h-0.031l-2.843-1.346h-0.031l-0.031-0.031l-1.655-1.126l-0.062-0.031l-2.218-1.157L349.776,112.635z"></path>',
		center: { x: 345, y: 178 },
		radius: 40
	},
	{
		id: 'izmir',
		name: 'İzmir',
		exploreSuffix: "'i İncele",
		viewBox: '13.73399999999998 175.607 124.02 112.846',
		viewBoxObj: { x: 13.734, y: 175.607, w: 124.020, h: 112.846 },
		path: '<path d="M71.427,180.607l-1.531,0.78h-0.031l-0.062,0.031l-3.188,0.842l-2.845,1.998l-2.282,1.499 l-0.125,0.094h-0.126l-2.094,0.124l-3.095,1.436l-0.062,0.031l-1.751,1.687l-0.062,0.031l-0.062,0.031l-2.845,1.373l0.438,0.531 l0.125,0.188l-0.031,0.188l-0.157,1.281l1.125,0.563h0.062l0.062,0.062l2.655,2.313l0.125,0.094l0.031,0.125l0.718,2.156 l0.031,0.125v0.094l-0.564,3.062l-0.031,0.25l-0.25,0.125l-3.189,1.31l-0.439,1.314l-0.189,1.312v0.062v0.062l0.187,1.346 l1.155,1.47l5.844,0.003h0.188l0.125,0.125l1.937,1.595h0.031l2.999,2.127l0.25,0.188l-0.031,0.312l-0.376,2.125l-0.031,0.344 l-0.344,0.062l-3.5,0.873l-0.062,0.031l-2.94,1.218h-0.031l-1.312,0.655l0.312,0.625l0.062,0.125v0.094l-0.001,2.344v0.125 l-0.062,0.125l-1.251,1.968l-0.219,0.312l-0.344-0.094l-2.5-0.72h-0.031l-2.188-0.689l-1.25,0.343h-0.031l-2.157,1.249 l-0.471,4.094l2.249,1.626h0.031l3.404,2.877l0.125,0.094l0.031,0.156l1.06,3.751l0.031,0.062v0.062l-0.001,1.375l1.437,1.282 l0.094,0.095l0.031,0.125l0.437,1.25l7.281-0.34h0.188l0.125,0.094l1.374,0.97l0.438-0.656l0.219-0.344l0.375,0.156l2.312,0.876 l0.312,0.125v0.344l-0.001,1.438v0.219l-0.125,0.125l-1.407,1.405l-0.031,0.031l-1.032,1.218l-0.156,0.156l-0.219,0.031 l-3.562,0.186h-0.125l-0.094-0.062l-1.75-0.782l-2.063,1.468l-0.094,0.062h-0.125l-3.75,0.373h-0.064H52.67l-7.125-0.379h-0.094 h-0.062l-1.594-0.563l-0.312-0.094l-0.031-0.312l-0.155-1.844l-1.469-0.532l-1.75,0.874l-1.002,4.405l-0.188,0.875l-0.656-0.625 l-1.593-1.595l-0.156-0.156v-0.25l0.19-3l-0.531-0.656l-1.405-1.095l-0.375-0.281l0.25-0.375l0.782-1.219l-0.656-0.406 l-0.219-0.156v-0.281l0.001-1.594v-0.5h0.5l2.594,0.001l0.095-1.156l-1.624-1.97l-0.031-0.031l-0.031-0.031l-1.249-2.345 l-0.031-0.031v-0.031l-1.06-2.845l-1.029-2.845l-3.843-1.596l-0.812,0.562l-0.062,0.031l-0.031,0.031l-2.094,0.811l-0.44,2.75 l1.03,2.376v0.062l0.031,0.031l0.654,3.562l1.624,1.313l0.031,0.031l3.718,2.658l0.219,0.156v0.281l-0.19,3.375l-0.031,0.469 h-0.469l-1.094-0.001l-1.313,2.593l-0.062,0.156l-0.188,0.062l-2.22,1.03l-0.094,0.062l-2.407,1.718l-0.094,0.062l-0.125,0.031 l-1.969,0.343l-0.471,0.097l-0.094-0.469l-0.311-1.469l-1-0.22l-1.813,1.937l2.405,2.72l0.531-0.438l0.219-0.156l0.281,0.094 l2.5,0.876l0.031,0.031l0.031,0.031l3.593,2.127l0.031,0.031l0.031,0.031l2.843,2.314l0.188,0.156v0.25l-0.158,2.906l1.562,0.157 h0.094l1.5-0.155l0.471-4.062l0.062-0.436h0.438l2.656,0.001l5.188,0.003h0.25l0.156,0.219l1.249,1.782h0.031l1.936,3.063 l0.031,0.031l0.031,0.031l1.404,3.22l0.031,0.062l0.031,0.062l0.436,2.875l1.156-0.561l0.125-0.094L50.254,267l5.375,0.722h0.125 l0.125,0.094l2.843,2.314l3.592,2.783l0.062,0.031l4.218,1.408l2.156,0.72l0.344,0.094v0.377l-0.003,5.188v0.094l-0.062,0.094 l-0.563,1.438l1.562,0.501l1.656,0.595l2.938-0.436c0.09-0.108,0.883-1.044,1.813-2.124c0.491-0.57,1.017-1.135,1.439-1.593 c0.211-0.229,0.372-0.438,0.531-0.594s0.253-0.236,0.469-0.344c0.029-0.015,0.267-0.199,0.531-0.406s0.578-0.468,0.875-0.719 c0.594-0.501,1.126-0.968,1.126-0.968l0.125-0.094l0.156-0.031c0,0,1.185-0.107,2.438-0.218c0.626-0.056,1.276-0.125,1.812-0.155 c0.268-0.015,0.487-0.029,0.688-0.031c0.201-0.002,0.363-0.002,0.531,0.031c0.409,0.082,0.61,0.331,0.906,0.594 s0.614,0.583,0.938,0.907s0.629,0.627,0.906,0.875s0.57,0.43,0.594,0.438c0.276,0.092,1.493,0.375,2.562,0.595 c1.003,0.208,1.796,0.355,1.906,0.376l9.062-0.495h0.031l2.751-1.217l0.094-0.031H107c0,0,1.016,0.016,2.094,0.063 c0.539,0.024,1.106,0.065,1.562,0.095s0.741,0.029,1,0.095c0.176,0.044,0.842,0.172,1.406,0.251 c0.499,0.069,0.84,0.113,0.938,0.126c0.013,0.002,0.125,0,0.125,0l3.5-0.498h0.031l2.062-0.811l1.376-1.749l0.031-0.031l1.44-3.53 l0.062-0.094l0.062-0.094l0.875-0.875l0.219-0.219l0.281,0.094l1.844,0.626h0.062v0.031c0.058,0.011,1.443,0.247,3.124,1.283 c0.712,0.438,1.088,0.374,1.344,0.251s0.375-0.312,0.375-0.312l0.72-1.719l1.221-2.874l-0.249-2.75l-1.748-2.907l-2.937-1.846 h-0.031l-2.624-1.939h-0.062l-2.469-0.751l-7.062-0.379l-0.312-0.031l-0.125-0.281l-0.624-1.375l-1.529-3.657l-3.5-0.471h-0.031 l-0.031-0.031l-2.812-0.721l-3.563-0.222l-0.472,4.938v0.125l-0.094,0.125l-1.376,1.874l-0.281,0.375l-0.375-0.219l-2.28-1.407 l-0.094-0.062l-0.062-0.094l-1.249-1.876l-2.154-3.032l-0.031-0.062l-0.031-0.062l-0.811-2.469l-2.749-1.627h-0.033l-3.75-0.877 l-0.094-0.031l-0.062-0.031l-3.03-2.033l-0.063-0.034l-0.031-0.062l-2.529-2.751l-2.03-1.657l-3.25-0.721l-0.031-0.031h-0.031 l-3.78-1.127l-0.188-0.062l-0.094-0.188c0,0-0.317-0.617-0.718-1.312c-0.402-0.695-0.955-1.495-1.187-1.689 c-0.351-0.293-0.454-0.738-0.468-1.125c-0.015-0.387,0.071-0.76,0.157-1.125c0.143-0.615,0.313-1,0.376-1.156l-0.687-2.312 l-0.031-0.094l-1.343-2.626l-0.031-0.062l-2.437-2.657l-0.094-0.125l-0.031-0.125l-0.498-3.156l-0.03-0.252l0.156-0.188 l1.595-1.718l0.031-0.031l2.377-3.499l0.094-0.156l0.188-0.031l3.656-0.904h0.031h0.031l4.281-0.623l4.094-0.748l3.563-2.154 l2.033-3.311l-0.123-2.626l-0.843-2.094l-0.031-0.062l-0.031-0.094l-0.372-5.156v-0.031v-0.031l0.003-5.375v-0.031l-0.718-1.563 v-0.031l-2.061-2.376l-0.094-0.156l-0.031-0.156l-0.093-2.344l-0.312-0.125l-5.249-1.753h-0.062l-3.844-0.877h-0.062l-0.062-0.031 L71.427,180.607z"></path>',
		center: { x: 78, y: 238 },
		radius: 28
	},
	{
		id: 'eskisehir',
		name: 'Eskişehir',
		exploreSuffix: "'i İncele",
		viewBox: '217.09299999999993 138.742 115.47399999999996 84.17900000000014',
		viewBoxObj: { x: 217.093, y: 138.742, w: 115.474, h: 84.179 },
		path: '<path d="M260.04,143.742l-2.219,0.187l0.031,0.062l-0.656,0.156l-2.812,0.592l-0.094,0.031 l-1.812,0.843l-0.031,0.031h-0.031l-1.906,0.561l-1.22,1.874v0.031l-0.031,0.031l-1.282,1.53l-0.031,0.062l-0.094,0.031 l-1.156,0.687l-0.783,2.906v0.031l-0.47,2.344l-0.031,0.219l-0.188,0.125l-2.407,1.499l-0.064,0.064h-0.094l-2.406,0.499 l-0.97,0.968l-0.031,0.062l-1.595,2.093l-0.031,0.031h-0.031l-1.376,1.405l-0.062,0.062l-0.062,0.031l-1.781,0.874l-0.094,0.062 h-0.125l-6.938,0.121l-2,0.811l-2.032,2.374l-0.031,0.031l-1.001,1.374l0.123,2.844l1.779,1.097l0.281,0.188l-0.062,0.312 l-0.094,0.75l1.438,0.001l4.281,0.002h0.125l0.094,0.062l2.405,1.126l0.281,0.125v0.312l0.186,3.656l1.404,3.032l2.561,1.813v0.031 h0.031l2.53,2.095l0.156,0.125v0.188l0.591,5.438v0.188l-0.094,0.156c0,0-0.347,0.499-0.751,1.031 c-0.202,0.266-0.427,0.557-0.625,0.781c-0.099,0.112-0.185,0.194-0.281,0.281c-0.063,0.057-0.167,0.107-0.25,0.156 c-0.02,0.033-0.056,0.115-0.094,0.219c-0.076,0.207-0.15,0.516-0.219,0.812c-0.115,0.5-0.164,0.856-0.189,1l1.999,2.72l0.094,0.094 v0.125l0.467,2.781l1.81,2.845l0.188,0.281l-0.156,0.25l2.719,0.689l0.125,0.031l0.062,0.094c0,0,1.63,1.415,2.748,2.908 c0.446,0.594,1.354,1.178,2.124,1.563c0.65,0.325,1.03,0.446,1.188,0.501c0.174-0.138,0.471-0.379,1.094-0.718 c0.784-0.428,1.791-0.851,2.812-0.623c0.917,0.204,1.516,0.697,1.937,1.095s0.667,0.64,0.906,0.689 c0.346,0.069,1.311,0.135,2.219,0.157s1.799,0.001,2.156,0.001c0.637,0,1.779,0.001,2.062,0.001l2.502-3.874l0.219-0.281 l0.344,0.062l2.844,0.721l2.469,0.657c0.185-0.142,1.238-0.953,2.563-1.905c0.718-0.516,1.478-1.042,2.095-1.437 c0.308-0.197,0.576-0.345,0.812-0.469c0.236-0.124,0.359-0.25,0.688-0.25c-0.015,0,0.158-0.017,0.344-0.062 s0.417-0.105,0.688-0.188c0.542-0.164,1.2-0.371,1.844-0.593c1.288-0.443,2.5-0.905,2.5-0.905l0.219-0.062l0.188,0.094l3.218,1.783 l0.094,0.062l0.062,0.094c0,0,0.428,0.55,0.843,1.219c0.208,0.335,0.398,0.675,0.561,1.031c0.164,0.356,0.312,0.689,0.311,1.062 c0,0.48-0.051,1.264,0.03,1.938c0.041,0.337,0.122,0.639,0.219,0.844c0.097,0.205,0.172,0.307,0.281,0.344 c0.615,0.205,1.508,0.623,2.499,1.063c0.992,0.441,2.065,0.899,2.968,1.064c2.04,0.372,6.311,1.597,6.311,1.597l0.094,0.031 l0.094,0.094l1.311,1.191l6.905,1.254l4.689-1.966l-0.062-0.062l3.408-4.279l0.062-0.094l0.125-0.062l4.595-1.936l0.031-0.031 h0.031l4.001-2.154l0.313-2.188l-2.343-2.345l-0.094-0.094l-0.031-0.125l-0.904-3.375l-0.031-0.156l0.062-0.125l1.565-5.218 l-1.403-4.845l-2.278-5.845l-0.031-0.031l-2.091-4.375l-0.031-0.031l-3.528-6.221l-0.219-0.375l0.312-0.281l4.158-3.342 c-0.483-0.34-1.445-1.002-2.187-1.595c-0.351-0.281-1.47-0.938-2.468-1.47c-0.998-0.533-1.905-0.97-1.905-0.97l-0.156-0.094 l-0.062-0.156l-2.153-5.189l-2.123-3.063l-6.344-0.191h-0.094l-0.062-0.031l-5.53-1.972l-6.093-1.909l-5.595,1.216l-0.125,0.031 l-0.125-0.031c0,0-1.162-0.315-2.406-0.626c-0.622-0.156-1.254-0.323-1.781-0.439s-0.999-0.189-1.031-0.189 c-0.232,0-0.789,0.129-1.312,0.28s-1.042,0.338-1.438,0.437c-0.6,0.15-0.966,0.479-2.439,1.03c-1.531,0.573-3.031,0.56-3.031,0.56 h-0.25l-0.156-0.188c0,0-0.25-0.333-0.594-0.656c-0.344-0.323-0.789-0.562-0.969-0.563c-0.68,0-1.208-0.408-1.625-0.751 s-0.719-0.688-0.719-0.688l-0.062-0.094l-0.031-0.094l-0.561-2.156l-1.186-3.47l-1.562,0.187h-0.125l-0.094-0.031l-2.78-1.064 v-0.031h-0.031L260.04,143.742z"></path>',
		center: { x: 285, y: 178 },
		radius: 28
	}
];

let currentMapUsers = {
	istanbul: [],
	ankara: [],
	izmir: [],
	eskisehir: []
};

// Harita Kullanıcıları Önbelleği İçin Sabitler
const MAP_CACHE_KEY = 'mapUsersCacheV3';
const MAP_CACHE_TIME_KEY = 'mapUsersCacheTimeV3';
const MAP_CACHE_DURATION = 5 * 60 * 1000; // 5 dakika (milisaniye cinsinden)

function initMap() {
	const mapSection = document.getElementById('mapSection');
	if (!mapSection) return;

	if (mapSection.innerHTML === '') {
		let htmlContent = '';
		CITIES.forEach(city => {
			htmlContent += `
				<div class="city-container" id="cityContainer-${city.id}">
					<h3 class="city-map-title">${city.name}</h3>
					<div class="map-wrapper map-wrapper-${city.id}" id="mapWrapper-${city.id}">
						<svg version="1.1" id="svg-${city.id}" xmlns="http://www.w3.org/2000/svg" viewBox="${city.viewBox}">
							<g id="${city.id}-paths" class="istanbul-map-group">
								${city.path}
							</g>
						</svg>
						<div class="map-avatars-container" id="mapAvatarsContainer-${city.id}"></div>
					</div>
					<div class="map-actions">
						<button class="btn-map-action" id="btnExplore-${city.id}"></button>
						<button class="btn-map-action" id="btnActiveDrinkers-${city.id}" disabled>Anlık İçicilere Bak</button>
					</div>
				</div>
			`;
		});
		mapSection.innerHTML = htmlContent;

		// Event listener'ları ve buton metinlerini bağla
		CITIES.forEach(city => {
			const btnExplore = document.getElementById(`btnExplore-${city.id}`);
			if (btnExplore) {
				btnExplore.innerText = `${city.name}${city.exploreSuffix}`;
				btnExplore.addEventListener('click', () => openDrinkersModal(city.id));
			}
		});
	}
	mapSection.style.display = 'block';
}

function clearMap() {
	const mapSection = document.getElementById('mapSection');
	if (mapSection) {
		mapSection.innerHTML = '';
		mapSection.style.display = 'none';
	}
	currentMapUsers = {
		istanbul: [],
		ankara: [],
		izmir: [],
		eskisehir: []
	};
}

async function loadMapData() {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		// Harita sadece giriş yapmış kullanıcılara gösterilir.
		// public_profiles view'ı artık yalnızca authenticated 
		// kullanıcılara açık — anon erişimi Supabase'de revoke edildi.
		console.warn("Yetkisiz harita yükleme girişimi engellendi.");
		clearMap();
		return;
	}

	// 5 Dakikalık Önbellek (Cache) Kontrolü
	const cachedTime = localStorage.getItem(MAP_CACHE_TIME_KEY);
	const cachedData = localStorage.getItem(MAP_CACHE_KEY);
	const now = Date.now();

	if (cachedTime && cachedData && (now - parseInt(cachedTime, 10) < MAP_CACHE_DURATION)) {
		try {
			console.log("Harita kullanıcı verileri yerel depolamadan (Cache) yüklendi.");
			currentMapUsers = JSON.parse(cachedData);
			CITIES.forEach(city => {
				renderMapUsers(city.id, currentMapUsers[city.id]);
			});
			return;
		} catch (e) {
			console.error("Yerel harita önbelleği okunamadı, yeniden çekiliyor:", e);
		}
	}

	try {
		console.log("Fetching map users from Supabase...");
		// Fetch up to 100 onboarded users, sorted by latest updates
		const { data, error } = await supabase
			.from('public_profiles')
			.select('id, display_name, nickname, avatar_url, preferred_locations, updated_at')
			.order('updated_at', { ascending: false })
			.limit(100);

		if (error) throw error;

		// Reset lists
		currentMapUsers = {
			istanbul: [],
			ankara: [],
			izmir: [],
			eskisehir: []
		};

		if (data) {
			data.forEach(profile => {
				if (profile.preferred_locations && Array.isArray(profile.preferred_locations)) {
					profile.preferred_locations.forEach(loc => {
						const parts = loc.split(',');
						if (parts.length >= 2) {
							const rawCity = parts[0].trim();
							const dist = parts[1].trim();

							const normalize = (str) => str
								.replace(/İ/g, 'i')
								.replace(/I/g, 'i')
								.replace(/Ş/g, 's')
								.replace(/Ğ/g, 'g')
								.replace(/Ü/g, 'u')
								.replace(/Ö/g, 'o')
								.replace(/Ç/g, 'c')
								.toLowerCase();

							const city = normalize(rawCity);

							if (city === 'istanbul') {
								currentMapUsers.istanbul.push({
									id: profile.id,
									display_name: profile.display_name,
									nickname: profile.nickname,
									avatar_url: profile.avatar_url,
									district: dist,
									updated_at: profile.updated_at
								});
							} else if (city === 'ankara') {
								currentMapUsers.ankara.push({
									id: profile.id,
									display_name: profile.display_name,
									nickname: profile.nickname,
									avatar_url: profile.avatar_url,
									district: dist,
									updated_at: profile.updated_at
								});
							} else if (city === 'izmir') {
								currentMapUsers.izmir.push({
									id: profile.id,
									display_name: profile.display_name,
									nickname: profile.nickname,
									avatar_url: profile.avatar_url,
									district: dist,
									updated_at: profile.updated_at
								});
							} else if (city === 'eskisehir') {
								currentMapUsers.eskisehir.push({
									id: profile.id,
									display_name: profile.display_name,
									nickname: profile.nickname,
									avatar_url: profile.avatar_url,
									district: dist,
									updated_at: profile.updated_at
								});
							}
						}
					});
				}
			});

			// Önbelleğe kaydet
			localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(currentMapUsers));
			localStorage.setItem(MAP_CACHE_TIME_KEY, now.toString());

			// Her şehri ayrı ayrı çizdir
			CITIES.forEach(city => {
				renderMapUsers(city.id, currentMapUsers[city.id]);
			});
		}
	} catch (err) {
		console.error("Error loading map users:", err.message);
	}
}

function renderMapUsers(cityId, users) {
	const mapContainer = document.getElementById(`mapAvatarsContainer-${cityId}`);
	const svgEl = document.getElementById(`svg-${cityId}`);
	if (!mapContainer || !svgEl) return;
	mapContainer.innerHTML = '';

	const cityObj = CITIES.find(c => c.id === cityId);
	if (!cityObj) return;

	const stableUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
	const total = stableUsers.length;
	if (total === 0) return;

	const viewBox = cityObj.viewBoxObj;
	const center = cityObj.center;
	const maxRadius = cityObj.radius;

	// Harita üzerindeki kara parçalarını (path) bulalım
	const paths = Array.from(svgEl.querySelectorAll('path'));
	function isInsideLand(x, y) {
		if (paths.length === 0) return true;
		const pt = svgEl.createSVGPoint();
		pt.x = x;
		pt.y = y;
		return paths.some(p => p.isPointInFill(pt));
	}

	// Altın açı: noktaların üst üste binmemesi için
	const GOLDEN_ANGLE = 137.508;
	let seq = 0; // Sarmal sırası

	stableUsers.forEach((user, i) => {
		let svgX, svgY;
		let found = false;
		let attempts = 0;

		// Kara parçasına (path içine) denk gelene kadar sarmalda ilerle
		while (!found && attempts < 1000) {
			const t = seq / Math.max(total, 5);
			const r = maxRadius * Math.sqrt(t) * 0.75;

			const angleDeg = seq * GOLDEN_ANGLE;
			const angleRad = (angleDeg * Math.PI) / 180;

			svgX = center.x + r * Math.cos(angleRad);
			svgY = center.y + r * Math.sin(angleRad);

			if (isInsideLand(svgX, svgY)) {
				found = true;
			}
			seq++;
			attempts++;
		}

		if (!found) {
			svgX = center.x;
			svgY = center.y;
		}

		// SVG koordinatlarını container yüzdesine çevir
		const leftPercent = ((svgX - viewBox.x) / viewBox.w) * 100;
		const topPercent = ((svgY - viewBox.y) / viewBox.h) * 100;

		const pin = document.createElement('div');
		pin.className = 'map-user-pin';
		pin.style.left = `${leftPercent}%`;
		pin.style.top = `${topPercent}%`;
		pin.setAttribute('data-name', user.display_name);

		pin.addEventListener('click', () => {
			openProfileModal({ id: user.id });
		});

		const img = document.createElement('img');
		img.className = 'map-user-avatar';
		img.src = user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		img.alt = user.display_name;
		img.onerror = () => {
			img.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		};

		pin.appendChild(img);
		mapContainer.appendChild(pin);
	});
}

// Sayfalama için global state
let currentDrinkersPage = 1;
const DRINKERS_PER_PAGE = 20;

// Drinkers Bottom Sheet Modal Handlers
function openDrinkersModal(cityId) {
	const modal = document.getElementById('drinkersModal');
	const container = document.getElementById('drinkersListContainer');
	if (!modal || !container) return;

	container.innerHTML = '';
	currentDrinkersPage = 1;

	const cityObj = CITIES.find(c => c.id === cityId);
	const cityName = cityObj ? cityObj.name : '';

	const usersInCity = currentMapUsers[cityId] || [];

	// Modaldaki başlığı güncelle
	const modalTitle = modal.querySelector('h2');
	if (modalTitle) {
		modalTitle.innerHTML = `${cityName}'daki Biraseverler <span class="drinker-count-badge">${usersInCity.length}</span>`;
	}

	if (usersInCity.length === 0) {
		container.innerHTML = `<p style="text-align: center; color: var(--secondary-text); margin-top: 20px;">Henüz ${cityName}'da kayıtlı birasever bulunmuyor.</p>`;
	} else {
		renderDrinkersPage(usersInCity, container);
	}

	// Show modal
	document.body.style.overflow = 'hidden';
	modal.style.display = 'flex';
	setTimeout(() => {
		modal.classList.add('active');
	}, 10);
}

function renderDrinkersPage(usersInCity, container) {
	const startIndex = (currentDrinkersPage - 1) * DRINKERS_PER_PAGE;
	const endIndex = startIndex + DRINKERS_PER_PAGE;
	const usersToRender = usersInCity.slice(startIndex, endIndex);

	// Remove load more button if it exists before appending new items
	const existingLoadMoreBtn = container.querySelector('.btn-load-more');
	if (existingLoadMoreBtn) {
		existingLoadMoreBtn.remove();
	}

	const now = new Date();

	usersToRender.forEach(user => {
		const item = document.createElement('div');
		item.className = 'drinker-item';

		// YENİ damgası kontrolü (son 24 saat içinde updated_at)
		let isNew = false;
		if (user.updated_at) {
			const updatedAtDate = new Date(user.updated_at);
			const diffMs = now - updatedAtDate;
			const diffHours = diffMs / (1000 * 60 * 60);
			if (diffHours <= 24) {
				isNew = true;
			}
		}

		const avatarWrapper = document.createElement('div');
		avatarWrapper.className = 'drinker-avatar-wrapper';

		const avatarImg = document.createElement('img');
		avatarImg.className = 'drinker-avatar';
		avatarImg.src = user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		avatarImg.alt = user.display_name;
		avatarImg.onerror = (e) => {
			e.target.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		};
		avatarWrapper.appendChild(avatarImg);

		const infoDiv = document.createElement('div');
		infoDiv.className = 'drinker-info';

		const infoHeader = document.createElement('div');
		infoHeader.className = 'drinker-info-header';
		
		const nameSpan = document.createElement('span');
		nameSpan.className = 'drinker-name';
		nameSpan.textContent = user.display_name;
		infoHeader.appendChild(nameSpan);

		if (isNew) {
			const newBadge = document.createElement('span');
			newBadge.className = 'badge-new';
			newBadge.textContent = 'YENİ';
			infoHeader.appendChild(newBadge);
		}

		const locationSpan = document.createElement('span');
		locationSpan.className = 'drinker-location';
		locationSpan.textContent = user.district || '';

		infoDiv.appendChild(infoHeader);
		infoDiv.appendChild(locationSpan);

		// Aksiyon Butonları
		const actionsDiv = document.createElement('div');
		actionsDiv.className = 'drinker-actions';

		const viewBtn = document.createElement('button');
		viewBtn.className = 'btn-drinker-view';
		viewBtn.textContent = 'İncele';
		viewBtn.onclick = () => {
			openProfileModal({ id: user.id });
		};

		// Twitter Deep Link Butonu
		if (user.nickname) {
			const twitterBtn = document.createElement('a');
			twitterBtn.className = 'btn-drinker-twitter';
			twitterBtn.href = `https://x.com/${user.nickname}`;
			twitterBtn.target = '_blank';
			twitterBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>`;
			twitterBtn.onclick = (e) => {
				e.preventDefault();
				const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
				if (isMobile) {
					const start = Date.now();
					window.location.href = `twitter://user?screen_name=${user.nickname}`;
					setTimeout(() => {
						if (Date.now() - start < 1500) {
							window.open(`https://x.com/${user.nickname}`, '_blank');
						}
					}, 1000);
				} else {
					window.open(`https://x.com/${user.nickname}`, '_blank');
				}
			};
			actionsDiv.appendChild(viewBtn);
			actionsDiv.appendChild(twitterBtn);
		} else {
			actionsDiv.appendChild(viewBtn);
		}

		item.appendChild(avatarWrapper);
		item.appendChild(infoDiv);
		item.appendChild(actionsDiv);

		container.appendChild(item);
	});

	if (endIndex < usersInCity.length) {
		const loadMoreBtn = document.createElement('button');
		loadMoreBtn.className = 'btn-load-more';
		loadMoreBtn.textContent = 'Daha Fazla Yükle';
		loadMoreBtn.onclick = () => {
			currentDrinkersPage++;
			renderDrinkersPage(usersInCity, container);
		};
		container.appendChild(loadMoreBtn);
	}
}

function closeDrinkersModal() {
	const modal = document.getElementById('drinkersModal');
	if (!modal) return;

	modal.classList.remove('active');
	setTimeout(() => {
		modal.style.display = 'none';
		document.body.style.overflow = '';
	}, 350);
}

// Bind Map Buttons and Load Map on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
	const closeBtn = document.getElementById('closeDrinkersBtn');
	const overlay = document.getElementById('drinkersModalOverlay');

	if (closeBtn) {
		closeBtn.addEventListener('click', closeDrinkersModal);
	}
	if (overlay) {
		overlay.addEventListener('click', closeDrinkersModal);
	}
});