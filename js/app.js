// Supabase'i ES Module olarak içe aktarıyoruz
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { districtsMap } from './turkey-cities.js';

function formatName(name) {
	if (!name) return '';
	return name.length > 15 ? name.substring(0, 15) + '...' : name;
}

const SUPABASE_URL = 'https://qryjfafoimjcwcuruzah.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mYbPrK4EDrlByE_ziop0Ug_nY_wjwaz';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VALID_CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Eskişehir'];

const VALID_BEER_STYLES = [
	'Narenciye (Portakal/Limon)',
	'Tropikal (Mango/Ananas)',
	'Kırmızı Meyve (Çilek/Vişne)',
	'Yeşil & Ferah (Elma/Kivi)',
	'Egzotik & Farklı (Nar/Şeftali)'
];
const VALID_OTHER_ALCOHOLS = [
	'Çay', 'Kahve', 'Americano', 'Soda', 'Ayran', 'Latte', 'Filtre Kahve', 'İçmiyorum'
];
const VALID_FREQUENCY = [
	'Her Gün', 'Neredeyse Her Gün', 'Haftada Birkaç', 'Sadece Hafta Sonları', 'Ayda Yılda Bir'
];
const VALID_ENVIRONMENT = [
	'Evde / Kendi Başıma', 'Kafe / Pastane', 'Arkadaşlarla / Kalabalık', 'Açık Hava / Sahil'
];
const VALID_ABV = ['Düşük (%25 - %50)', 'Orta (%50 - %75)', 'Yüksek (%75 - %100)'];
const VALID_SNACK = [
	'Çerez / Cips', 'Patates / Hamburger', 'Güzel Bir Yemek', 'Hiçbir Şey / Sadece Meyve Suyu'
];

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

const landingLoginBtn = document.getElementById('landingLoginBtn');
if (landingLoginBtn) {
	landingLoginBtn.addEventListener('click', async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'twitter',
			options: {
				redirectTo: window.location.origin
			}
		});
		if (error) console.error("Giriş başlatılamadı:", error.message);
	});
}

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

	if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
		if (!session) {
			loginBtn.style.display = 'flex';
			userContainer.style.display = 'none';
			document.getElementById('setupScreen').style.display = 'none';

			const mapSectionHeader = document.getElementById('mapSectionHeader');
			if (mapSectionHeader) mapSectionHeader.style.display = 'none';

			const landingPage = document.getElementById('landingPage');
			if (landingPage) landingPage.style.display = 'flex';

			clearMap();
			return;
		} else {
			const landingPage = document.getElementById('landingPage');
			if (landingPage) landingPage.style.display = 'none';
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
					userName.innerText = formatName(profileData.display_name);
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

			userName.innerText = formatName(dbProfile.display_name);
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
			userName.innerText = formatName(twitterData.display_name);
			userAvatar.src = twitterData.avatar_url;

			if (!dbProfile) {
				// İlk defa geliyorsa profili default değerlerle oluşturalım
				const { error: upsertError } = await supabase.from('profiles').upsert(twitterData, { onConflict: 'id' });
				if (upsertError) {
					console.error("Profil oluşturulamadı:", upsertError);
				}
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
			alert("Lütfen en az 1 favori meyve suyu tarzı seçiniz.");
			return;
		}
		if (selectedOtherAlcohols.length === 0) {
			alert("Lütfen diğer içecek tercihlerinizi seçiniz.");
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
		const kvkkCheck = document.getElementById('kvkkCheck');
		if (kvkkCheck && !kvkkCheck.checked) {
			alert("Lütfen KVKK Aydınlatma Metni'ni okuyup onaylayınız.");
			return;
		}

		if (saveProfileBtn._isSubmitting) return;
		saveProfileBtn._isSubmitting = true;
		saveProfileBtn.disabled = true;
		const originalBtnText = saveProfileBtn.textContent;
		saveProfileBtn.textContent = 'Kaydediliyor...';

		const resetBtn = () => {
			saveProfileBtn._isSubmitting = false;
			saveProfileBtn.disabled = false;
			saveProfileBtn.textContent = originalBtnText;
		};

		const bioInput = document.getElementById('bioInput');
		const rawBio = bioInput ? bioInput.value : '';
		const sanitizedBio = rawBio.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim().substring(0, 100);

		const environment = getPillValue('environmentGroup');
		if (!environment) {
			alert("Lütfen tercih ettiğiniz içim ortamını seçiniz.");
			resetBtn();
			return;
		}
		const abv = getPillValue('abvGroup');
		if (!abv) {
			alert("Lütfen tercih ettiğiniz meyve oranını seçiniz.");
			resetBtn();
			return;
		}
		const snack = getPillValue('snackGroup');
		if (!snack) {
			alert("Lütfen meyve suyunun yanındaki atıştırmalık tercihinizi seçiniz.");
			resetBtn();
			return;
		}
		const frequency = getPillValue('frequencyGroup');
		if (!frequency) {
			alert("Lütfen meyve suyu içme sıklığınızı seçiniz.");
			resetBtn();
			return;
		}

		const safeStyles = selectedBeerStyles.filter(v => VALID_BEER_STYLES.includes(v));
		const safeAlcohols = selectedOtherAlcohols.filter(v => VALID_OTHER_ALCOHOLS.includes(v));
		const safeLocations = selectedLocations.slice(0, 3);

		if (safeStyles.length === 0) {
			alert("Lütfen geçerli bir meyve suyu tarzı seçiniz.");
			resetBtn(); return;
		}
		if (safeAlcohols.length === 0) {
			alert("Lütfen geçerli bir içecek tercihi seçiniz.");
			resetBtn(); return;
		}
		if (!VALID_FREQUENCY.includes(frequency)) {
			alert("Geçersiz sıklık değeri."); resetBtn(); return;
		}
		if (!VALID_ENVIRONMENT.includes(environment)) {
			alert("Geçersiz ortam değeri."); resetBtn(); return;
		}
		if (!VALID_ABV.includes(abv)) {
			alert("Geçersiz ABV değeri."); resetBtn(); return;
		}
		if (!VALID_SNACK.includes(snack)) {
			alert("Geçersiz atıştırmalık değeri."); resetBtn(); return;
		}

		// Supabase profiles tablosunu güncelle
		const updateData = {
			is_onboarded: true,
			bio: sanitizedBio,
			favorite_styles: safeStyles,
			other_alcohols: safeAlcohols,
			preferred_locations: safeLocations,
			drinking_frequency: frequency,
			drinking_environment: environment,
			abv_preference: abv,
			drinking_snack: snack,
			updated_at: new Date().toISOString()
		};

		const { data: updatedProfile, error } = await supabase
			.from('profiles')
			.update(updateData)
			.eq('id', user.id)
			.select()
			.maybeSingle();

		if (error) {
			console.error("Supabase upsert error:", error);
			alert("Profil kurulumu tamamlanırken bir hata oluştu: " + error.message);
			resetBtn();
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
				favorite_styles: safeStyles,
				other_alcohols: safeAlcohols,
				preferred_locations: safeLocations,
				drinking_frequency: frequency,
				drinking_environment: environment,
				abv_preference: abv,
				drinking_snack: snack
			};
			localStorage.setItem(localKey, JSON.stringify(localData));
			localStorage.setItem(`user_profile_fetched_at_${user.id}`, Date.now().toString());

			// Arayüzü güncelle
			userName.innerText = formatName(twitterData.display_name);
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
			resetBtn();
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
	profileDisplayName.innerText = formatName(profileData.display_name || '');
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
		const groupedLocs = {};
		profileData.preferred_locations.forEach(loc => {
			const parts = loc.split(',');
			if (parts.length >= 2) {
				const city = parts[0].trim();
				const dist = parts[1].trim();
				if (!groupedLocs[city]) groupedLocs[city] = [];
				groupedLocs[city].push(dist);
			} else {
				const city = loc.trim();
				if (!groupedLocs[city]) groupedLocs[city] = [];
			}
		});

		Object.keys(groupedLocs).forEach(city => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			if (groupedLocs[city].length > 0) {
				span.innerText = `${city} (${groupedLocs[city].join(', ')})`;
			} else {
				span.innerText = city;
			}
			prefLocations.appendChild(span);
		});
	} else {
		prefLocations.innerHTML = '<span class="pref-tag">Belirtilmemiş</span>';
	}

	// Meyve Suyu Tarzları
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

	// Diğer İçecekler
	prefOtherAlcohols.innerHTML = '';

	const beverageColors = {
		"Çay": { bg: "#d1fae5", border: "#10b981", color: "#047857" },
		"Kahve": { bg: "#fef3c7", border: "#d97706", color: "#92400e" },
		"Americano": { bg: "#f5f5f4", border: "#57534e", color: "#292524" },
		"Soda": { bg: "#e0f2fe", border: "#0ea5e9", color: "#0369a1" },
		"Ayran": { bg: "#f1f5f9", border: "#64748b", color: "#475569" },
		"Latte": { bg: "#fff7ed", border: "#f59e0b", color: "#b45309" },
		"Filtre Kahve": { bg: "#f3e8ff", border: "#a855f7", color: "#6d28d9" },
		"İçmiyorum": { bg: "#f5f5f4", border: "#78716c", color: "#57504b" }
	};

	if (profileData.other_alcohols && profileData.other_alcohols.length > 0) {
		profileData.other_alcohols.forEach(alc => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = alc;

			// Her içecek seçeneği için pastel renk setini uygula
			if (beverageColors[alc]) {
				span.style.backgroundColor = beverageColors[alc].bg;
				span.style.borderColor = beverageColors[alc].border;
				span.style.color = beverageColors[alc].color;
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
	lockScroll();
	profileModal.style.display = 'flex';
	setTimeout(() => {
		profileModal.classList.add('active');
	}, 10);
}

// Scroll kilitleme yardımcı fonksiyonları
function lockScroll() {
	document.body.style.overflow = 'hidden';
	document.documentElement.style.overflow = 'hidden';
}
function unlockScroll() {
	document.body.style.overflow = '';
	document.documentElement.style.overflow = '';
}

// Profil modalını kapatma
function closeProfileModal() {
	profileModal.classList.remove('active');

	const modalContent = document.querySelector('.profile-modal-content');
	const modalOverlay = document.getElementById('profileModalOverlay');

	profileModal.addEventListener('transitionend', () => {
		if (!profileModal.classList.contains('active')) {
			if (modalContent) modalContent.style.willChange = 'auto';
			if (modalOverlay) modalOverlay.style.willChange = 'auto';
		}
	}, { once: true });

	setTimeout(() => {
		profileModal.style.display = 'none';
		unlockScroll();
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

// KVKK Modal Mantığı
const kvkkModal = document.getElementById('kvkkModal');
const kvkkModalOverlay = document.getElementById('kvkkModalOverlay');
const closeKvkkBtn = document.getElementById('closeKvkkBtn');
const acceptKvkkBtn = document.getElementById('acceptKvkkBtn');

function openKvkkModal(e) {
	if (e) e.preventDefault();
	lockScroll();
	kvkkModal.style.display = 'flex';
	setTimeout(() => {
		kvkkModal.classList.add('active');
	}, 10);
}

function closeKvkkModal() {
	kvkkModal.classList.remove('active');
	kvkkModal.addEventListener('transitionend', () => {
		if (!kvkkModal.classList.contains('active')) {
			kvkkModal.style.display = 'none';
			unlockScroll();
		}
	}, { once: true });
}

document.addEventListener('click', (e) => {
	if (e.target && e.target.id === 'openKvkkModalBtn') {
		openKvkkModal(e);
	}
});

if (closeKvkkBtn) closeKvkkBtn.addEventListener('click', closeKvkkModal);
if (kvkkModalOverlay) kvkkModalOverlay.addEventListener('click', closeKvkkModal);
if (acceptKvkkBtn) {
	acceptKvkkBtn.addEventListener('click', () => {
		const kvkkCheck = document.getElementById('kvkkCheck');
		if (kvkkCheck) kvkkCheck.checked = true;
		closeKvkkModal();
	});
}



// Fire Effect Particles Generation (CSS Particle iptal edildi, fire.gif kullanılıyor)
/*
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
*/

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
		path: '<path d="M349.776,112.635l-0.47,0.969l-0.062,0.125l-0.125,0.062l-1.939,1.187 c-0.027,0.051-0.064,0.094-0.094,0.188c-0.017,0.052-0.029,0.072-0.031,0.094c0.143,0.115,0.289,0.261,0.5,0.469 c0.238,0.234,0.543,0.507,0.812,0.781c0.538,0.55,1.03,1.063,1.03,1.063l0.094,0.125l0.031,0.125l0.437,2.156l0.062,0.375 l-0.344,0.156l-2.439,1.218l-0.062,0.031l-3.939,2.748h-0.031l-2.689,1.624h-0.031l-6.314,3.028c0,0-0.03,0.031-0.031,0.031 c-0.034,0.019-0.626,0.327-1.281,0.687c-0.337,0.185-0.677,0.381-0.969,0.53c-0.146,0.075-0.262,0.135-0.375,0.188 s-0.182,0.092-0.312,0.125c0.058-0.015-0.245,0.115-0.531,0.25s-0.656,0.297-1,0.468c-0.688,0.344-1.312,0.687-1.312,0.687 l-3.157,2.342v0.031h-0.031l-1.876,1.249l-0.125,0.094h-0.125c0,0-6.978-0.004-7.781-0.004c-0.198,0-1.069,0.195-1.781,0.437 c-0.678,0.229-1.226,0.446-1.281,0.468l-0.062,0.031l-1.813,0.968l-0.125,0.031h-0.125l-5.719-0.065h-0.094l-0.094-0.062 l-3.561-1.596l-0.125-0.062l-0.062-0.062l-1.343-1.532l-1.094-0.782l-3.625,0.404h-0.031l-3,0.529l-0.156,0.031l-0.159-0.066 l-2.03-1.157l-0.031-0.031l-2.843-1.314l-2.03-1.001l-1.344,0.124l-0.907,1.874l-0.031,0.062v0.031l-1.064,4.03v0.094l-0.062,0.062 l-1.501,2.218l-0.031,0.031l-0.031,0.031l-1.532,1.624l-0.094,0.125l-0.188,0.031l-3.531,0.404l-0.125,0.031l-2.345,1.03h-0.031 l-2.657,1.311l-1.625,0.843l1.248,3.563v0.031h0.031l0.499,2.031c0.063,0.07,0.213,0.233,0.5,0.469 c0.342,0.282,0.787,0.531,1,0.532c0.713,0,1.241,0.454,1.656,0.845c0.285,0.268,0.387,0.39,0.5,0.531 c0.169-0.003,1.266-0.005,2.5-0.468c1.386-0.519,1.703-0.886,2.532-1.093c0.319-0.08,0.889-0.246,1.438-0.405 c0.549-0.16,1.08-0.311,1.562-0.311c0.324,0,0.706,0.1,1.25,0.22c0.544,0.119,1.185,0.282,1.812,0.439 c1.206,0.302,2.225,0.571,2.312,0.595l5.595-1.216l0.125-0.031l0.125,0.031l6.249,1.972l5.405,1.941h0.031l6.562,0.192h0.25 l0.156,0.219l2.31,3.376l0.031,0.031l0.031,0.062l2.059,5.001c0.125,0.063,0.818,0.409,1.75,0.907 c1.011,0.54,2.082,1.13,2.624,1.563c0.861,0.689,2.655,1.97,2.655,1.97l0.562,0.375l-0.531,0.406l-4.314,3.467l3.372,5.908v0.031 l2.154,4.47v0.031l2.309,5.876l0.031,0.031v0.031l1.435,5.001l0.031,0.125l-0.031,0.156l-1.597,5.218l0.842,3.125l2.405,2.407 l0.156,0.156l-0.031,0.25l-0.345,2.688l-0.031,0.25l-0.216,0.127l-4.313,2.31v0.031h-0.031l-4.532,1.936l-3.128,3.905l3.593,2.252 l0.125,0.062l0.062,0.125l1.748,3.532l1.623,3.063l4.438,0.471l4.657-1.966l0.094-0.062h0.094l4.312,0.002h0.125l0.094,0.062 l5.467,2.753l0.094,0.031l4.593,1.441l7.282-2.434l4.972-4.716l0.094-0.094l0.125-0.031l3.345-0.936l3.908-4.342l1.002-2.968 l0.125-0.438l0.438,0.094l3.969,0.69l2.096-3.249l0.219-0.375l0.406,0.188l5.311,2.534l0.031,0.031l0.062,0.031l9.371,7.693 l1.563-1.405v-0.031l1.063-1.749l0.188-0.344l0.375,0.125l2.344,0.72l0.281,0.094l0.062,0.312l0.155,1.031l1.937,1.313l0.094,0.031 l0.062,0.094l2.498,3.751l0.031,0.062v0.031l1.092,2.876l0.031,0.125l-0.031,0.156l-0.877,3.75l-0.031,0.125l-0.125,0.125 l-0.906,0.906l0.341,5.281l1.968,2.532l1.812,0.876l0.596-3.438l0.125-0.688l0.594,0.344l2.311,1.251l0.094,0.031 l0.062,0.094l2.498,3.22l0.062,0.062l0.031,0.062l0.874,2.312l0.062,0.156l-0.031,0.125l-0.501,2.312l1.655,2.313l0.062,0.062l0.75-0.469 l1.752-3.624l1.94-4.093v-0.031l0.47-2.625l-0.937-2.719l-2.624-2.657l-0.312-0.312l0.25-0.344l2.346-3.03l0.063-0.086l0.094-0.062 l4.563-2.467l0.625-0.938l-4.249-1.752l-0.062-0.031h-0.031l-2.155-1.439l-0.031-0.031l-0.062-0.062l-3.092-3.471h-0.031 l-3.874-2.314l-0.094-0.062l-0.031-0.062l-3.217-3.752l-0.031-0.031l-0.031-0.031l-1.904-3.282l-2.061-1.563l-0.219-0.156v-0.25 l0.002-3.719l-1.968-1.813l-0.094-0.062l-0.033-0.129l-0.905-2.5l-0.031-0.125l0.031-0.156l0.846-3.969l-0.655-2.781l-3.561-2.377 l-0.094-0.062l-0.062-0.094l-0.999-1.689l-0.062-0.094l-1.874-1.876l-0.156-0.156v-0.188l0.001-2.312v-0.188l0.094-0.125 l2.971-4.186l0.501-2.156l0.378-6.25v-0.094l0.031-0.094l1.439-2.687l0.847-4.844l0.062-0.406l0.406-0.031l6.094-0.341l4.158-3.123 h0.031h0.031l1.907-1.187l-1.218-2.47l-0.031-0.062v-0.094l-0.529-3.562l-0.031-0.031v-0.031l0.002-3.594v-0.125l0.094-0.125 l2.658-4.28l2.722-4.624l-4.407-1.438h-0.031l-0.031-0.031l-3.624-1.908l-4.624-1.066h-0.031l-4.344,0.186l-1.876,1.905 l-0.689,2.031l-0.094,0.281l-0.281,0.062l-1.969,0.343l-0.25,0.031l-0.188-0.156l-3.217-3.033v-0.031l-2.687-2.657l-0.062-0.062 l-0.031-0.062l-1.061-1.97l-0.062-0.094v-0.094l-0.155-2.625l-4.779-2.878l-0.031-0.031l-0.031-0.031l-1.624-1.439l-0.125-0.125 l-0.031-0.188l-0.343-2.656l-0.031-0.219l0.094-0.156l1.657-2.343l-2.906-0.346h-0.062l-0.031-0.031l-2.5-0.876l-0.031-0.031 h-0.031l-2.843-1.346h-0.031l-0.031-0.031l-1.655-1.126l-0.062-0.031l-2.218-1.157L349.776,112.635z"></path>',
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
const MAP_CACHE_KEY = 'mapUsersCacheV6';
const MAP_CACHE_TIME_KEY = 'mapUsersCacheTimeV6';
const MAP_CACHE_DURATION = 5 * 60 * 1000; // 5 dakika (milisaniye cinsinden)

function initMap() {
	const mapSection = document.getElementById('mapSection');
	const mapSectionHeader = document.getElementById('mapSectionHeader');

	if (mapSection) {
		// Çift render/çift efekt sorununu önlemek için: Eğer harita iskeleti zaten çizildiyse, tekrar sıfırlama!
		if (mapSection.querySelector('.city-container')) {
			mapSection.style.display = 'block';
			if (mapSectionHeader) mapSectionHeader.style.display = 'block';
			return;
		}

		let htmlContent = '';
		CITIES.forEach(city => {
			htmlContent += `
				<div class="city-container" id="cityContainer-${city.id}">
					<div class="city-badge">${city.name}</div>
					<div class="map-wrapper map-wrapper-${city.id}" id="mapWrapper-${city.id}">
						<svg version="1.1" id="svg-${city.id}" xmlns="http://www.w3.org/2000/svg" viewBox="${city.viewBox}">
							<g id="${city.id}-paths" class="istanbul-map-group">
								${city.path}
							</g>
						</svg>
						<div class="map-avatars-container" id="mapAvatarsContainer-${city.id}"></div>
					</div>
					<div class="city-footer">
						<div class="city-stats" id="cityStats-${city.id}">
							Toplam <strong id="cityTotal-${city.id}">0</strong> kullanıcı
						</div>
						<div class="city-controls">
							<div style="display: flex; gap: 8px; align-items: center; margin: 0 auto;">
								<button class="btn-map-action" id="btnExplore-${city.id}"></button>
							</div>
						</div>
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
	if (mapSectionHeader) mapSectionHeader.style.display = 'block';

	// Sehir gorunurluk ayarlarini uygula
	applyCityVisibility();

	// Eklenmis (pinned) sehirleri render et
	initPinnedCities();
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

// -------------------------------------------------------------
// Orijinal loadMapData Fonksiyonunu Genişletilmiş Olarak Eziyoruz
// -------------------------------------------------------------
window.loadMapData = async function (force = false) {
	const nowTime = Date.now();
	if (!force && window.lastMapRenderTime && nowTime - window.lastMapRenderTime < 1500) {
		console.log("Çift harita yüklemesi (double effect) engellendi.");
		return;
	}
	window.lastMapRenderTime = nowTime;

	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		console.warn("Yetkisiz harita yükleme girişimi engellendi.");
		clearMap();
		return;
	}

	// Switch disabled durumunu kaldırıyoruz (Giriş yapıldığında)
	const globalToggle = document.getElementById('globalLiveToggle');
	if (globalToggle) globalToggle.disabled = false;

	// EĞER LIVE MOD AÇIKSA
	if (isLiveMode) {
		try {
			console.log("Fetching live sessions from Supabase...");
			const { data, error } = await supabase.from('public_live_sessions').select('*');
			if (error) throw error;

			currentMapUsers = { istanbul: [], ankara: [], izmir: [], eskisehir: [] };

			// Pinned sehirler icin de bos dizi olustur
			const pinnedLiveIds = getHomepageCityOrder().filter(id => !DEFAULT_CITY_IDS.includes(id));
			pinnedLiveIds.forEach(id => { currentMapUsers[id] = []; });

			if (data) {
				data.forEach(sess => {
					const normalize = (str) => str.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c').replace(/ç/g, 'c').toLowerCase();
					const cityId = normalize(sess.city);
					if (currentMapUsers[cityId]) currentMapUsers[cityId].push(sess);
				});

				CITIES.forEach(city => {
					if (currentMapUsers[city.id]) renderLivePins(currentMapUsers[city.id], city.id);
				});
			}
		} catch (err) {
			console.error("Error loading live sessions:", err.message);
		}
		return;
	}

	// NORMAL MOD
	const cachedTime = localStorage.getItem(MAP_CACHE_TIME_KEY);
	const cachedData = localStorage.getItem(MAP_CACHE_KEY);
	const now = Date.now();

	if (cachedTime && cachedData && (now - parseInt(cachedTime, 10) < MAP_CACHE_DURATION)) {
		try {
			currentMapUsers = JSON.parse(cachedData);
			// Sadece varsayilan 4 sehir icin cache'den render et (pinned'lar ayri yuklenir)
			DEFAULT_CITY_IDS.forEach(cityId => {
				if (currentMapUsers[cityId]) renderMapUsers(cityId, currentMapUsers[cityId]);
			});
			// Pinned sehirlerin verisini de yukle
			const pinnedCacheIds = getHomepageCityOrder().filter(id => !DEFAULT_CITY_IDS.includes(id));
			if (pinnedCacheIds.some(id => document.getElementById(`mapAvatarsContainer-${id}`))) {
				loadPinnedCityData();
			}
			return;
		} catch (e) {
			console.error("Yerel harita önbelleği okunamadı:", e);
		}
	}

	try {
		const { data, error } = await supabase
			.from('public_profiles')
			.select('id, display_name, nickname, avatar_url, preferred_locations, updated_at')
			.order('updated_at', { ascending: false })
			.limit(10000); // Varsayılan 1000 sınırına takılmamak için yüksek limit

		if (error) throw error;

		currentMapUsers = { istanbul: [], ankara: [], izmir: [], eskisehir: [] };

		if (data) {
			data.forEach(profile => {
				if (profile.preferred_locations && Array.isArray(profile.preferred_locations)) {
					const groupedLocs = {};
					const normalize = (str) => str.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c').replace(/ç/g, 'c').toLowerCase();

					profile.preferred_locations.forEach(loc => {
						const parts = loc.split(',');
						const rawCity = parts[0].trim();
						const city = normalize(rawCity);
						if (currentMapUsers[city]) {
							if (!groupedLocs[city]) groupedLocs[city] = [];
							if (parts.length >= 2) {
								groupedLocs[city].push(parts[1].trim());
							}
						}
					});

					Object.keys(groupedLocs).forEach(city => {
						const distString = groupedLocs[city].length > 0 ? groupedLocs[city].join(', ') : 'Bütün Şehir';
						currentMapUsers[city].push({
							id: profile.id,
							display_name: profile.display_name,
							nickname: profile.nickname,
							avatar_url: profile.avatar_url,
							district: distString,
							updated_at: profile.updated_at
						});
					});
				}
			});

			localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(currentMapUsers));
			localStorage.setItem(MAP_CACHE_TIME_KEY, now.toString());

			CITIES.forEach(city => { renderMapUsers(city.id, currentMapUsers[city.id]); });
		}

		// Pinned sehirler icin de veri yukle (sadece container'lar zaten varsa - ilk yuklemeyi initPinnedCities yapar)
		const pinnedOrder = getHomepageCityOrder().filter(id => !DEFAULT_CITY_IDS.includes(id));
		const hasPinnedContainers = pinnedOrder.some(id => document.getElementById(`mapAvatarsContainer-${id}`));
		if (hasPinnedContainers) {
			await loadPinnedCityData();
		}
	} catch (err) {
		console.error("Error loading map users:", err.message);
	}
}

// Harita Pinleri İçin Sabit Random Üretici (Seeded Random)
// Amaç: Kullanıcı sayfayı yenilediğinde veya önbellek güncellendiğinde ikonların sürekli yer değiştirmesini engellemek
function cyrb128(str) {
	let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
	return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a, b, c, d) {
	return function () {
		a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
		var t = (a + b) | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = (c << 21 | c >>> 11);
		d = d + 1 | 0;
		t = t + d | 0;
		c = c + t | 0;
		return (t >>> 0) / 4294967296;
	}
}

function renderMapUsers(cityId, users) {
	if (!users) users = [];
	const mapContainer = document.getElementById(`mapAvatarsContainer-${cityId}`);
	const svgEl = document.getElementById(`svg-${cityId}`);
	if (!mapContainer || !svgEl) return;
	mapContainer.innerHTML = '';

	const cityObj = CITIES.find(c => c.id === cityId);
	if (!cityObj) return;

	const total = users.length;

	// Toplam kullanıcı sayısını güncelle
	const totalCounter = document.getElementById(`cityTotal-${cityId}`);
	if (totalCounter) {
		totalCounter.innerText = total;
	}

	if (total === 0) return;

	// YENİ KULLANICILARIN GÖZÜKMESİ İÇİN: 
	// users dizisi veritabanından 'updated_at' (en yeni) sıralamasıyla geliyor.
	// Önce en yeni 100 kişiyi seçiyoruz (Böylece yeni kayıt olanlar haritada mutlaka çıkar)
	const latestUsersToPin = users.slice(0, 100);

	// Sonra bu 100 kişiyi kendi aralarında ID'ye göre sıralıyoruz ki 
	// haritaya yerleştirilme algoritmaları sabit (deterministic) çalışsın ve titreme yapmasın.
	const stableUsersToPin = [...latestUsersToPin].sort((a, b) => a.id.localeCompare(b.id));

	const viewBox = cityObj.viewBoxObj;
	const center = cityObj.center;

	// Harita üzerindeki kara parçalarını (path) bulalım
	const paths = Array.from(svgEl.querySelectorAll('path'));
	function isInsideLand(x, y) {
		if (paths.length === 0) return true;
		const pt = svgEl.createSVGPoint();
		pt.x = x;
		pt.y = y;
		return paths.some(p => p.isPointInFill(pt));
	}

	const placedPoints = [];
	const usersToPin = stableUsersToPin;

	usersToPin.forEach((user, i) => {
		let bestX = center.x;
		let bestY = center.y;
		let maxClosestDist = -1;

		// Her kullanıcı için kendi ID'sinden türetilen sabit bir seed oluşturuyoruz (Sayfa yenilense de pin yeri aynı kalır)
		const userSeed = cyrb128(user.id || i.toString());
		const rand = sfc32(userSeed[0], userSeed[1], userSeed[2], userSeed[3]);

		// Optimizasyon: Aday sayısını 400'e çıkararak iğneleri birbirine en uzak noktalara yerleştiriyoruz
		for (let attempts = 0; attempts < 400; attempts++) {
			// Yarıçap (circle) kısıtlamasını tamamen iptal ettik! 
			// Artık noktalar sadece merkeze değil, tüm viewBox (şehrin tamamı) alanına rastgele üretiliyor.
			// isInsideLand fonksiyonu zaten denizin veya harita dışının seçilmesini engelliyor.
			const testX = viewBox.x + (rand() * viewBox.w);
			const testY = viewBox.y + (rand() * viewBox.h);

			if (isInsideLand(testX, testY)) {
				let closestDist = Infinity;
				for (const p of placedPoints) {
					const dx = testX - p.x;
					const dy = testY - p.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < closestDist) {
						closestDist = dist;
					}
				}

				// Eğer ilk noktaysa direkt kabul et
				if (placedPoints.length === 0) {
					bestX = testX;
					bestY = testY;
					break;
				}

				// En uzak mesafeyi sunan noktayı en iyi aday olarak kaydet
				if (closestDist > maxClosestDist) {
					maxClosestDist = closestDist;
					bestX = testX;
					bestY = testY;
				}
			}
		}

		placedPoints.push({ x: bestX, y: bestY });

		let svgX = bestX;
		let svgY = bestY;

		// SVG koordinatlarını container yüzdesine çevir
		let leftPercent = ((svgX - viewBox.x) / viewBox.w) * 100;
		let topPercent = ((svgY - viewBox.y) / viewBox.h) * 100;

		const pin = document.createElement('div');
		pin.className = 'map-user-pin';
		pin.style.left = `${leftPercent}%`;
		pin.style.top = `${topPercent}%`;
		pin.setAttribute('data-name', formatName(user.display_name));

		pin.addEventListener('click', () => {
			openProfileModal({ id: user.id });
		});

		const img = document.createElement('img');
		img.className = 'map-user-avatar';

		// Map performans optimizasyonu: Büyük resimleri (400x400) haritada daha düşük boyutlu (_normal) versiyonuyla render ediyoruz
		let optimizedAvatar = user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		if (optimizedAvatar.includes('_400x400')) {
			optimizedAvatar = optimizedAvatar.replace('_400x400', '_normal');
		}

		// Animasyon Gecikmesi: Profil fotolarının aynı anda değil, patlamış mısır gibi sırayla açılması için rastgele ama sabit (seeded) bir gecikme veriyoruz
		const animDelay = rand() * 0.8;
		pin.style.animationDelay = `${animDelay}s`;

		img.src = optimizedAvatar;
		img.alt = formatName(user.display_name);
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
		modalTitle.innerHTML = `${cityName}'daki Maltoz Severler <span class="drinker-count-badge">${usersInCity.length}</span>`;
	}

	if (usersInCity.length === 0) {
		container.innerHTML = `<p style="text-align: center; color: var(--secondary-text); margin-top: 20px;">Henüz ${cityName}'da kayıtlı Maltoz sever bulunmuyor.</p>`;
	} else {
		renderDrinkersPage(usersInCity, container);
	}

	// Show modal
	lockScroll();
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
		nameSpan.textContent = formatName(user.display_name);
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

	const modalContent = modal.querySelector('.profile-modal-content');
	const modalOverlay = document.getElementById('drinkersModalOverlay');

	modal.addEventListener('transitionend', () => {
		if (!modal.classList.contains('active')) {
			if (modalContent) modalContent.style.willChange = 'auto';
			if (modalOverlay) modalOverlay.style.willChange = 'auto';
		}
	}, { once: true });

	setTimeout(() => {
		modal.style.display = 'none';
		// Eger dinamik harita modalindan acildiysa, geri o modala don
		const dynamicMapModal = document.getElementById('dynamicCityMapModal');
		if (dynamicMapModal && dynamicMapModal.style.display === 'flex') {
			// Dinamik harita hala acik, scroll'u kilitle birak
		} else {
			unlockScroll();
		}
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


/* ==============================================================
	 ANLIK İÇİYORUM (LIVE SESSIONS) & GLOBAL AYARLAR
============================================================== */
let isLiveMode = false;

// Global Map Refresh
document.addEventListener('DOMContentLoaded', () => {
	const btnGlobalRefresh = document.getElementById('btnGlobalRefresh');
	if (btnGlobalRefresh) {
		btnGlobalRefresh.addEventListener('click', () => {
			localStorage.removeItem('mapUsersCacheV3');
			localStorage.removeItem('mapUsersCacheTimeV3');
			location.reload();
		});
	}

	const globalLiveToggle = document.getElementById('globalLiveToggle');
	if (globalLiveToggle) {
		globalLiveToggle.addEventListener('change', (e) => {
			supabase.auth.getSession().then(({ data: { session } }) => {
				if (!session) {
					alert("Anlık mod özelliğini kullanmak için giriş yapmalısınız.");
					e.target.checked = false;
					return;
				}

				const isChecked = e.target.checked;
				const wrapper = document.getElementById('btnCreateLiveSessionWrapper');
				if (isChecked) {
					isLiveMode = true;
					document.querySelectorAll('.map-section').forEach(el => el.classList.add('live-mode'));
					if (wrapper) {
						wrapper.style.width = '36px';
						wrapper.style.opacity = '1';
						wrapper.style.marginLeft = '4px';
					}
					loadMapData(true);
				} else {
					isLiveMode = false;
					document.querySelectorAll('.map-section').forEach(el => el.classList.remove('live-mode'));
					if (wrapper) {
						wrapper.style.width = '0';
						wrapper.style.opacity = '0';
						wrapper.style.marginLeft = '0';
					}
					loadMapData(true);
				}
			});
		});
	}

	const btnCreateLiveSessionGlobal = document.getElementById('btnCreateLiveSessionGlobal');
	if (btnCreateLiveSessionGlobal) {
		btnCreateLiveSessionGlobal.addEventListener('click', () => {
			openCreateLiveSessionUI();
		});
	}
});

// Yeni Modal Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
	const submitLiveSessionBtn = document.getElementById('submitLiveSessionBtn');
	if (submitLiveSessionBtn) {
		submitLiveSessionBtn.addEventListener('click', async () => {
			const city = document.getElementById('liveCitySelect').value;
			const district = document.getElementById('liveDistrictSelect').value;
			const drinkTime = document.getElementById('liveDrinkTimeInput').value;
			const note = document.getElementById('liveNoteInput').value;

			if (!city || !district) {
				alert("Lütfen şehir ve ilçe seçin.");
				return;
			}

			await createLiveSession(city, district, note, drinkTime);
		});
	}

	const bindClose = (btnId, overlayId, modalId) => {
		const btn = document.getElementById(btnId);
		const overlay = document.getElementById(overlayId);
		if (btn) btn.addEventListener('click', () => closeCustomModal(modalId));
		if (overlay) overlay.addEventListener('click', () => closeCustomModal(modalId));
	};

	bindClose('closeLiveSessionBtn', 'liveSessionModalOverlay', 'liveSessionModal');
	bindClose('closeCreateLiveSessionBtn', 'createLiveSessionModalOverlay', 'createLiveSessionModal');

	const deleteLiveSessionBtn = document.getElementById('deleteLiveSessionBtn');
	if (deleteLiveSessionBtn) {
		deleteLiveSessionBtn.addEventListener('click', async () => {
			const sessionId = deleteLiveSessionBtn.getAttribute('data-session-id');
			if (sessionId) {
				if (confirm("İlanı silmek istediğine emin misin?")) {
					await deleteLiveSession(sessionId);
				}
			}
		});
	}
});

function closeCustomModal(modalId) {
	const modal = document.getElementById(modalId);
	if (!modal) return;
	modal.classList.remove('active');
	setTimeout(() => {
		modal.style.display = 'none';
		unlockScroll();
	}, 350);
}

async function openCreateLiveSessionUI() {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	const localKey = `user_profile_${user.id}`;
	let profile = null;
	try { profile = JSON.parse(localStorage.getItem(localKey)); } catch (e) { }

	if (!profile || !profile.preferred_locations || profile.preferred_locations.length === 0) {
		alert("Lütfen önce profilinizde tercih ettiğiniz konumları belirleyin.");
		return;
	}

	const { data: hasSession } = await supabase.rpc('has_recent_session');
	if (hasSession) {
		const { data: existingSessions } = await supabase
			.from('public_live_sessions')
			.select('*')
			.eq('user_id', user.id)
			.limit(1);
		if (existingSessions && existingSessions.length > 0) {
			openLiveSessionModal(existingSessions[0]);
		} else {
			alert("Zaten aktif bir ilanın var. 12 saat içinde yeni ilan açamazsın.");
		}
		return;
	}

	const citySelect = document.getElementById('liveCitySelect');
	const districtSelect = document.getElementById('liveDistrictSelect');

	citySelect.innerHTML = '<option value="" disabled selected>Şehir Seçin</option>';

	const userCities = new Set();
	profile.preferred_locations.forEach(loc => {
		const city = loc.split(',')[0].trim();
		if (VALID_CITIES.includes(city)) {
			userCities.add(city);
		}
	});

	userCities.forEach(city => {
		const opt = document.createElement('option');
		opt.value = city;
		opt.innerText = city;
		citySelect.appendChild(opt);
	});

	citySelect.onchange = () => {
		const city = citySelect.value;
		districtSelect.innerHTML = '<option value="" disabled selected>İlçe Seçin</option>';
		if (districtsMap[city]) {
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
	};

	document.getElementById('liveDrinkTimeInput').value = '';
	document.getElementById('liveNoteInput').value = '';
	lockScroll();
	const modal = document.getElementById('createLiveSessionModal');
	modal.style.display = 'flex';
	setTimeout(() => { modal.classList.add('active'); }, 10);
}

async function createLiveSession(city, district, note, drinkTime) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	if (!VALID_CITIES.includes(city)) {
		alert("Geçersiz şehir seçimi.");
		return;
	}
	if (district !== 'Bütün Şehir' && (!districtsMap[city] || !districtsMap[city].includes(district))) {
		alert("Geçersiz ilçe seçimi.");
		return;
	}

	const { data: hasSession } = await supabase.rpc('has_recent_session');
	if (hasSession) {
		alert("Zaten bir ilan açtın. Aynı kullanıcı 12 saat içinde yeni ilan açamaz.");
		return;
	}

	const sanitizedNote = note.replace(/<[^>]*>?/gm, '').trim().substring(0, 50);
	const sanitizedDrinkTime = drinkTime.replace(/<[^>]*>?/gm, '').trim().substring(0, 100);
	const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

	const { error } = await supabase.from('live_sessions').insert({
		user_id: user.id,
		city,
		district,
		note: sanitizedNote || null,
		drink_time: sanitizedDrinkTime || null,
		expires_at: expiresAt
	});

	if (error) {
		alert("İlan oluşturulurken bir hata oluştu: " + error.message);
	} else {
		closeCustomModal('createLiveSessionModal');
		loadMapData();
	}
}

async function deleteLiveSession(sessionId) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	// 🌟 KESİN ÇÖZÜM: .update() yerine doğrudan yukarıda yazdığımız veritabanı fonksiyonunu çağırıyoruz
	const { error } = await supabase.rpc('sil_live_session', {
		p_session_id: sessionId
	});

	if (error) {
		alert("İlan silinirken bir hata oluştu: " + error.message);
	} else {
		closeCustomModal('liveSessionModal');
		loadMapData();
	}
}

async function openLiveSessionModal(session) {
	const { data: { user } } = await supabase.auth.getUser();
	const isCurrentUser = user && user.id === session.user_id;

	document.getElementById('liveSessionAvatar').src = session.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
	document.getElementById('liveSessionDisplayName').innerText = formatName(session.display_name || '');
	document.getElementById('liveSessionNickname').innerText = session.nickname ? `@${session.nickname}` : '';

	document.getElementById('liveSessionLocation').innerText = `${session.city}, ${session.district}`;
	document.getElementById('liveSessionDrinkTime').innerText = session.drink_time ? session.drink_time : '';
	document.getElementById('liveSessionNote').innerText = session.note ? session.note : '';

	const createdDate = new Date(session.created_at);
	const diffMins = Math.floor((Date.now() - createdDate) / 60000);
	let timeAgoStr = diffMins < 60 ? `${diffMins} dakika önce` : `${Math.floor(diffMins / 60)} saat önce`;
	document.getElementById('liveSessionTimeAgo').innerText = timeAgoStr;

	const expiresDate = new Date(session.expires_at);
	const expiresDiffMins = Math.floor((expiresDate - Date.now()) / 60000);
	if (expiresDiffMins > 0) {
		const hours = Math.floor(expiresDiffMins / 60);
		const mins = expiresDiffMins % 60;
		document.getElementById('liveSessionExpiresIn').innerText = `${hours} saat ${mins} dakika sonra silinecek`;
	} else {
		document.getElementById('liveSessionExpiresIn').innerText = `Süresi doldu`;
	}

	const deleteBtn = document.getElementById('deleteLiveSessionBtn');
	if (isCurrentUser) {
		deleteBtn.style.display = 'inline-block';
		deleteBtn.setAttribute('data-session-id', session.id);
	} else {
		deleteBtn.style.display = 'none';
	}

	const viewProfileBtn = document.getElementById('viewLiveSessionProfileBtn');
	if (viewProfileBtn) {
		viewProfileBtn.onclick = () => {
			closeCustomModal('liveSessionModal');
			openProfileModal({ id: session.user_id });
		};
	}

	lockScroll();
	const modal = document.getElementById('liveSessionModal');
	modal.style.display = 'flex';
	setTimeout(() => { modal.classList.add('active'); }, 10);
}

function renderLivePins(sessions, cityId) {
	const mapContainer = document.getElementById(`mapAvatarsContainer-${cityId}`);
	const svgEl = document.getElementById(`svg-${cityId}`);
	if (!mapContainer || !svgEl) return;
	mapContainer.innerHTML = '';

	const cityObj = CITIES.find(c => c.id === cityId);
	if (!cityObj) return;

	const totalCounter = document.getElementById(`cityTotal-${cityId}`);
	if (totalCounter) totalCounter.innerText = sessions.length;

	if (sessions.length === 0) return;

	const viewBox = cityObj.viewBoxObj;
	const center = cityObj.center;
	const maxRadius = cityObj.radius;

	const paths = Array.from(svgEl.querySelectorAll('path'));
	function isInsideLand(x, y) {
		if (paths.length === 0) return true;
		const pt = svgEl.createSVGPoint();
		pt.x = x; pt.y = y;
		return paths.some(p => p.isPointInFill(pt));
	}

	const GOLDEN_ANGLE = 137.508;
	let seq = 0;

	sessions.forEach(session => {
		let svgX, svgY, found = false, attempts = 0;

		while (!found && attempts < 1000) {
			const t = seq / Math.max(sessions.length, 5);
			const r = maxRadius * Math.sqrt(t) * 0.75;
			const angleRad = (seq * GOLDEN_ANGLE * Math.PI) / 180;
			svgX = center.x + r * Math.cos(angleRad);
			svgY = center.y + r * Math.sin(angleRad);
			if (isInsideLand(svgX, svgY)) found = true;
			seq++; attempts++;
		}
		if (!found) { svgX = center.x; svgY = center.y; }

		const leftPercent = ((svgX - viewBox.x) / viewBox.w) * 100;
		const topPercent = ((svgY - viewBox.y) / viewBox.h) * 100;

		const pin = document.createElement('div');
		pin.className = 'map-user-pin live-pin';
		pin.style.left = `${leftPercent}%`;
		pin.style.top = `${topPercent}%`;
		pin.setAttribute('data-name', formatName(session.display_name));

		pin.addEventListener('click', () => openLiveSessionModal(session));

		const img = document.createElement('img');
		img.className = 'map-user-avatar';
		img.src = session.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		img.alt = formatName(session.display_name);

		const liveDot = document.createElement('div');
		liveDot.className = 'live-dot';

		pin.appendChild(img);
		pin.appendChild(liveDot);
		mapContainer.appendChild(pin);
	});
}

/* ==============================================================
	 ŞEHİR GÖRÜNÜMÜ AYARLARI (CITY SETTINGS)
============================================================== */
function applyCityVisibility() {
	const order = getHomepageCityOrder();

	// Tum city-container'lari gizle, sonra sirasina gore goster
	const mapSection = document.getElementById('mapSection');
	if (!mapSection) return;

	const allContainers = mapSection.querySelectorAll('.city-container');
	allContainers.forEach(c => { c.style.display = 'none'; });

	// Sirasina gore goster ve DOM sirasini guncelle
	order.forEach(cityId => {
		const container = document.getElementById(`cityContainer-${cityId}`);
		if (container) {
			container.style.display = 'block';
			mapSection.appendChild(container); // Siralama icin sona tasi
		}
	});
}

// Yardimci: Homepage sehir siralamasini oku
function getHomepageCityOrder() {
	try {
		const stored = localStorage.getItem('homepage_cities_v2');
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed) && parsed.length > 0) return parsed;
		}
	} catch (e) { }

	// Eski formata fallback
	try {
		const oldStored = localStorage.getItem('visible_cities_v1');
		if (oldStored) {
			const parsed = JSON.parse(oldStored);
			if (Array.isArray(parsed) && parsed.length > 0) return parsed;
		}
	} catch (e) { }

	return DEFAULT_CITY_IDS.slice();
}

// Yardimci: Homepage sehir siralamasini kaydet
function saveHomepageCityOrder(order) {
	localStorage.setItem('homepage_cities_v2', JSON.stringify(order));
	// Eski formati da guncelle (geriye uyumluluk)
	localStorage.setItem('visible_cities_v1', JSON.stringify(order));
}

const DEFAULT_CITY_IDS = ['istanbul', 'ankara', 'izmir', 'eskisehir'];

document.addEventListener('DOMContentLoaded', () => {
	const btnCitySettings = document.getElementById('btnCitySettings');
	const citySettingsModal = document.getElementById('citySettingsModal');
	const cityTogglesContainer = document.getElementById('cityTogglesContainer');
	const closeCitySettingsBtn = document.getElementById('closeCitySettingsBtn');
	const citySettingsModalOverlay = document.getElementById('citySettingsModalOverlay');

	if (btnCitySettings && citySettingsModal && cityTogglesContainer) {
		btnCitySettings.addEventListener('click', () => {
			openCitySettingsModal();
		});
	}

	const closeCitySettings = () => {
		if (citySettingsModal) {
			citySettingsModal.classList.remove('active');
			setTimeout(() => {
				citySettingsModal.style.display = 'none';
				unlockScroll();
			}, 350);
		}
	};

	if (closeCitySettingsBtn) closeCitySettingsBtn.addEventListener('click', closeCitySettings);
	if (citySettingsModalOverlay) citySettingsModalOverlay.addEventListener('click', closeCitySettings);
});

function openCitySettingsModal() {
	const citySettingsModal = document.getElementById('citySettingsModal');
	const cityTogglesContainer = document.getElementById('cityTogglesContainer');
	if (!citySettingsModal || !cityTogglesContainer) return;

	const order = getHomepageCityOrder();
	cityTogglesContainer.innerHTML = '';

	// Aciklama metni
	const desc = document.createElement('p');
	desc.style.cssText = 'text-align: center; color: var(--secondary-text); font-size: 14.5px; margin-bottom: 16px;';
	desc.innerText = 'Sirasini degistirmek icin surukle, gorunurlugu degistirmek icin isarete tikla.';
	cityTogglesContainer.appendChild(desc);

	const list = document.createElement('div');
	list.className = 'city-settings-list';
	list.id = 'citySettingsSortableList';

	order.forEach(cityId => {
		const cityObj = CITIES.find(c => c.id === cityId);
		const cityName = cityObj ? cityObj.name : getCityDisplayName(cityId);
		const isDefault = DEFAULT_CITY_IDS.includes(cityId);
		const isPinned = !isDefault;

		const item = document.createElement('div');
		item.className = 'city-settings-item';
		item.setAttribute('draggable', 'true');
		item.setAttribute('data-city-id', cityId);

		// Drag handle
		const handle = document.createElement('div');
		handle.className = 'drag-handle';
		handle.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 8h16M4 16h16"/></svg>';
		item.appendChild(handle);

		// Sehir adi
		const nameSpan = document.createElement('span');
		nameSpan.className = 'city-settings-item-name';
		nameSpan.innerText = cityName;
		item.appendChild(nameSpan);

		if (isPinned) {
			const badge = document.createElement('span');
			badge.className = 'city-settings-item-badge';
			badge.innerText = 'Eklendi';
			item.appendChild(badge);

			const removeBtn = document.createElement('button');
			removeBtn.className = 'btn-city-remove';
			removeBtn.title = 'Kaldir';
			removeBtn.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
			removeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (confirm(`${cityName} ana sayfadan kaldirilsin mi?`)) {
					unpinCityFromHomepage(cityId);
					openCitySettingsModal();
				}
			});
			item.appendChild(removeBtn);
		} else {
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = true;
			input.value = cityId;
			input.style.cssText = 'width: 18px; height: 18px; accent-color: var(--accent-color); cursor: pointer; flex-shrink: 0;';
			input.addEventListener('change', () => {
				const currentOrder = getHomepageCityOrder();
				if (!input.checked) {
					if (currentOrder.length <= 1) {
						input.checked = true;
						return;
					}
					const newOrder = currentOrder.filter(id => id !== cityId);
					saveHomepageCityOrder(newOrder);
				} else {
					if (!currentOrder.includes(cityId)) {
						currentOrder.push(cityId);
						saveHomepageCityOrder(currentOrder);
					}
				}
				applyCityVisibility();
				openCitySettingsModal();
			});
			item.appendChild(input);
		}

		list.appendChild(item);

		// Drag & Drop
		item.addEventListener('dragstart', (e) => {
			item.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', cityId);
		});

		item.addEventListener('dragend', () => {
			item.classList.remove('dragging');
			list.querySelectorAll('.city-settings-item').forEach(el => el.classList.remove('drag-over'));
		});

		item.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			const dragging = list.querySelector('.dragging');
			if (dragging && dragging !== item) {
				item.classList.add('drag-over');
			}
		});

		item.addEventListener('dragleave', () => {
			item.classList.remove('drag-over');
		});

		item.addEventListener('drop', (e) => {
			e.preventDefault();
			item.classList.remove('drag-over');
			const draggedId = e.dataTransfer.getData('text/plain');
			if (draggedId === cityId) return;

			const currentOrder = getHomepageCityOrder();
			const fromIdx = currentOrder.indexOf(draggedId);
			const toIdx = currentOrder.indexOf(cityId);
			if (fromIdx === -1 || toIdx === -1) return;

			currentOrder.splice(fromIdx, 1);
			currentOrder.splice(toIdx, 0, draggedId);
			saveHomepageCityOrder(currentOrder);
			applyCityVisibility();
			openCitySettingsModal();
		});

		// Touch surukle-birak
		let touchDragCityId = null;
		handle.addEventListener('touchstart', (e) => {
			e.preventDefault();
			touchDragCityId = cityId;
			item.classList.add('dragging');
		}, { passive: false });

		handle.addEventListener('touchmove', (e) => {
			e.preventDefault();
			const touch = e.touches[0];
			list.querySelectorAll('.city-settings-item').forEach(el => el.classList.remove('drag-over'));
			const target = document.elementFromPoint(touch.clientX, touch.clientY);
			if (target) {
				const targetItem = target.closest('.city-settings-item');
				if (targetItem && targetItem !== item) targetItem.classList.add('drag-over');
			}
		}, { passive: false });

		handle.addEventListener('touchend', (e) => {
			item.classList.remove('dragging');
			const touch = e.changedTouches[0];
			const target = document.elementFromPoint(touch.clientX, touch.clientY);
			if (target) {
				const targetItem = target.closest('.city-settings-item');
				if (targetItem && targetItem !== item) {
					const targetCityId = targetItem.getAttribute('data-city-id');
					if (targetCityId && touchDragCityId) {
						const currentOrder = getHomepageCityOrder();
						const fromIdx = currentOrder.indexOf(touchDragCityId);
						const toIdx = currentOrder.indexOf(targetCityId);
						if (fromIdx !== -1 && toIdx !== -1) {
							currentOrder.splice(fromIdx, 1);
							currentOrder.splice(toIdx, 0, touchDragCityId);
							saveHomepageCityOrder(currentOrder);
							applyCityVisibility();
							openCitySettingsModal();
						}
					}
				}
			}
			list.querySelectorAll('.city-settings-item').forEach(el => el.classList.remove('drag-over'));
			touchDragCityId = null;
		});
	});

	cityTogglesContainer.appendChild(list);

	lockScroll();
	citySettingsModal.style.display = 'flex';
	setTimeout(() => { citySettingsModal.classList.add('active'); }, 10);
}


/* ==============================================================
   TUM SEHIRLER MODULU
============================================================== */

const svgCache = {};
let currentDynamicCityId = null;
let currentDynamicCityName = null;

// Sehir adini SVG dosya ID'sine donustur
function normalizeCityId(name) {
	return name
		.replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
		.replace(/Ş/g, 's').replace(/ş/g, 's')
		.replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
		.replace(/Ü/g, 'u').replace(/ü/g, 'u')
		.replace(/Ö/g, 'o').replace(/ö/g, 'o')
		.replace(/Ç/g, 'c').replace(/ç/g, 'c')
		.toLowerCase();
}

// ID'den gorsel sehir adi
function getCityDisplayName(cityId) {
	const cityObj = CITIES.find(c => c.id === cityId);
	if (cityObj) return cityObj.name;

	// districtsMap'ten bul
	for (const name of Object.keys(districtsMap)) {
		if (normalizeCityId(name) === cityId) return name;
	}
	return cityId;
}

// SVG dosyasini fetch et ve onbellekle
async function fetchCitySvg(cityId) {
	if (svgCache[cityId]) return svgCache[cityId];
	try {
		const resp = await fetch(`./cities/${cityId}.svg`);
		if (!resp.ok) return null;
		const text = await resp.text();
		svgCache[cityId] = text;
		return text;
	} catch (e) {
		console.error('SVG yuklenemedi:', cityId, e);
		return null;
	}
}

// SVG metnini parse et
function parseCitySvg(svgText) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgText, 'image/svg+xml');
	const svg = doc.querySelector('svg');
	if (!svg) return null;

	const viewBox = svg.getAttribute('viewBox');
	const g = svg.querySelector('g');
	const paths = svg.querySelectorAll('path');
	let pathsHtml = '';
	paths.forEach(p => {
		// Inline stilleri kaldir, CSS ile yonetilecek
		const clone = p.cloneNode(true);
		clone.removeAttribute('style');
		pathsHtml += clone.outerHTML;
	});

	return { viewBox, pathsHtml };
}

// CITIES dizisine dinamik sehir ekle (yoksa)
function ensureCityInArray(cityId, cityName, viewBox, pathsHtml) {
	if (CITIES.find(c => c.id === cityId)) return;

	const vb = viewBox.split(/[\s,]+/).map(Number);
	const viewBoxObj = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
	const center = { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
	const radius = Math.min(vb[2], vb[3]) / 3;

	CITIES.push({
		id: cityId,
		name: cityName,
		exploreSuffix: "'i Incele",
		viewBox: viewBox,
		viewBoxObj: viewBoxObj,
		path: pathsHtml,
		center: center,
		radius: radius,
		isPinned: true
	});
}


/* ---- TUM SEHIRLER MODALI ---- */

async function openAllCitiesModal() {
	const modal = document.getElementById('allCitiesModal');
	const grid = document.getElementById('allCitiesGrid');
	const loadingState = document.getElementById('allCitiesLoadingState');
	if (!modal || !grid) return;

	grid.innerHTML = '';
	if (loadingState) loadingState.style.display = 'block';

	lockScroll();
	modal.style.display = 'flex';
	setTimeout(() => { modal.classList.add('active'); }, 10);

	// Veri cekmeden once oturum kontrolu
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		if (loadingState) loadingState.innerText = 'Giris yapmalisiniz.';
		return;
	}

	// Tum profilleri cek ve sehir bazinda say
	try {
		const { data, error } = await supabase
			.from('public_profiles')
			.select('preferred_locations')
			.not('preferred_locations', 'is', null)
			.limit(10000);

		if (error) throw error;

		const cityCounts = {};
		if (data) {
			data.forEach(profile => {
				if (!profile.preferred_locations || !Array.isArray(profile.preferred_locations)) return;
				const seenCities = new Set();
				profile.preferred_locations.forEach(loc => {
					const cityName = loc.split(',')[0].trim();
					const cityId = normalizeCityId(cityName);
					if (!seenCities.has(cityId)) {
						seenCities.add(cityId);
						if (!cityCounts[cityId]) cityCounts[cityId] = { name: cityName, count: 0 };
						cityCounts[cityId].count++;
					}
				});
			});
		}

		if (loadingState) loadingState.style.display = 'none';

		// Alfabetik sirala (Turkce)
		const sortedCities = Object.entries(cityCounts)
			.sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));

		if (sortedCities.length === 0) {
			grid.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 20px;">Henuz veri bulunamadi.</p>';
			return;
		}

		sortedCities.forEach(([cityId, info]) => {
			const btn = document.createElement('button');
			btn.className = 'all-cities-btn';
			btn.innerHTML = `<span class="all-cities-btn-name">${info.name}</span><span class="all-cities-btn-count">${info.count} kullanici</span>`;
			btn.addEventListener('click', () => {
				openDynamicCityMap(cityId, info.name);
			});
			grid.appendChild(btn);
		});

	} catch (err) {
		console.error('Tum sehirler yuklenemedi:', err);
		if (loadingState) loadingState.innerText = 'Veriler yuklenirken hata olustu.';
	}
}

function closeAllCitiesModal() {
	const modal = document.getElementById('allCitiesModal');
	if (!modal) return;
	modal.classList.remove('active');
	setTimeout(() => {
		modal.style.display = 'none';
		unlockScroll();
	}, 350);
}


/* ---- DINAMIK SEHIR HARITASI ---- */

async function openDynamicCityMap(cityId, cityName) {
	const modal = document.getElementById('dynamicCityMapModal');
	const wrapper = document.getElementById('dynamicMapWrapper');
	const title = document.getElementById('dynamicCityMapTitle');
	const totalEl = document.getElementById('dynamicCityTotal');
	const pinBtn = document.getElementById('btnPinToHomepage');
	if (!modal || !wrapper) return;

	currentDynamicCityId = cityId;
	currentDynamicCityName = cityName;
	if (title) title.innerText = cityName;
	wrapper.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 40px 0;">Harita yukleniyor...</p>';
	if (totalEl) totalEl.innerText = '0';

	// Pin butonu durumunu guncelle
	const currentOrder = getHomepageCityOrder();
	if (pinBtn) {
		if (currentOrder.includes(cityId)) {
			pinBtn.innerText = 'Zaten Eklendi';
			pinBtn.disabled = true;
			pinBtn.style.opacity = '0.5';
		} else {
			pinBtn.innerText = 'Ana Sayfaya Ekle';
			pinBtn.disabled = false;
			pinBtn.style.opacity = '1';
		}
	}

	// Modali goster
	lockScroll();
	modal.style.display = 'flex';
	setTimeout(() => { modal.classList.add('active'); }, 10);

	// SVG yukle
	const svgText = await fetchCitySvg(cityId);
	if (!svgText) {
		wrapper.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 40px 0;">Harita bulunamadi.</p>';
		return;
	}

	const parsed = parseCitySvg(svgText);
	if (!parsed) {
		wrapper.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 40px 0;">Harita islenilemedi.</p>';
		return;
	}

	// CITIES dizisine ekle
	ensureCityInArray(cityId, cityName, parsed.viewBox, parsed.pathsHtml);

	// SVG'yi render et
	const vb = parsed.viewBox.split(/[\s,]+/).map(Number);
	const aspectRatio = vb[2] / vb[3];

	wrapper.innerHTML = `
		<svg version="1.1" id="svg-dynamic-${cityId}" xmlns="http://www.w3.org/2000/svg" viewBox="${parsed.viewBox}" style="aspect-ratio: ${aspectRatio};">
			<g class="istanbul-map-group">
				${parsed.pathsHtml}
			</g>
		</svg>
		<div class="map-avatars-container" id="mapAvatarsDynamic-${cityId}"></div>
	`;

	// Kullanici verilerini cek ve pinleri yerlestir
	try {
		const { data, error } = await supabase
			.from('public_profiles')
			.select('id, display_name, nickname, avatar_url, preferred_locations, updated_at')
			.order('updated_at', { ascending: false })
			.limit(10000);

		if (error) throw error;

		const usersInCity = [];
		if (data) {
			const normalize = normalizeCityId;
			data.forEach(profile => {
				if (!profile.preferred_locations || !Array.isArray(profile.preferred_locations)) return;
				const groupedLocs = {};
				let matchesCity = false;

				profile.preferred_locations.forEach(loc => {
					const parts = loc.split(',');
					const rawCity = parts[0].trim();
					const city = normalize(rawCity);
					if (city === cityId) {
						matchesCity = true;
						if (!groupedLocs[city]) groupedLocs[city] = [];
						if (parts.length >= 2) groupedLocs[city].push(parts[1].trim());
					}
				});

				if (matchesCity) {
					const distString = groupedLocs[cityId] && groupedLocs[cityId].length > 0
						? groupedLocs[cityId].join(', ') : 'Butun Sehir';
					usersInCity.push({
						id: profile.id,
						display_name: profile.display_name,
						nickname: profile.nickname,
						avatar_url: profile.avatar_url,
						district: distString,
						updated_at: profile.updated_at
					});
				}
			});
		}

		// currentMapUsers'a ekle (drinkers modal icin)
		currentMapUsers[cityId] = usersInCity;
		if (totalEl) totalEl.innerText = usersInCity.length;

		// Pinleri render et (dinamik harita icin ozel)
		renderDynamicMapPins(cityId, usersInCity, parsed.viewBox);

	} catch (err) {
		console.error('Dinamik harita kullanicilari yuklenemedi:', err);
	}
}

function renderDynamicMapPins(cityId, users, viewBoxStr) {
	const mapContainer = document.getElementById(`mapAvatarsDynamic-${cityId}`);
	const svgEl = document.getElementById(`svg-dynamic-${cityId}`);
	if (!mapContainer || !svgEl) return;
	mapContainer.innerHTML = '';

	if (users.length === 0) return;

	const vb = viewBoxStr.split(/[\s,]+/).map(Number);
	const viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };

	const paths = Array.from(svgEl.querySelectorAll('path'));
	function isInsideLand(x, y) {
		if (paths.length === 0) return true;
		const pt = svgEl.createSVGPoint();
		pt.x = x; pt.y = y;
		return paths.some(p => p.isPointInFill(pt));
	}

	const latestUsers = users.slice(0, 100);
	const stableUsers = [...latestUsers].sort((a, b) => a.id.localeCompare(b.id));
	const placedPoints = [];

	stableUsers.forEach((user) => {
		let bestX = viewBox.x + viewBox.w / 2;
		let bestY = viewBox.y + viewBox.h / 2;
		let maxClosestDist = -1;

		const userSeed = cyrb128(user.id || '0');
		const rand = sfc32(userSeed[0], userSeed[1], userSeed[2], userSeed[3]);

		for (let attempts = 0; attempts < 400; attempts++) {
			const testX = viewBox.x + (rand() * viewBox.w);
			const testY = viewBox.y + (rand() * viewBox.h);

			if (isInsideLand(testX, testY)) {
				let closestDist = Infinity;
				for (const p of placedPoints) {
					const dx = testX - p.x;
					const dy = testY - p.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < closestDist) closestDist = dist;
				}

				if (placedPoints.length === 0) {
					bestX = testX; bestY = testY; break;
				}
				if (closestDist > maxClosestDist) {
					maxClosestDist = closestDist;
					bestX = testX; bestY = testY;
				}
			}
		}

		placedPoints.push({ x: bestX, y: bestY });

		const leftPercent = ((bestX - viewBox.x) / viewBox.w) * 100;
		const topPercent = ((bestY - viewBox.y) / viewBox.h) * 100;

		const pin = document.createElement('div');
		pin.className = 'map-user-pin';
		pin.style.left = `${leftPercent}%`;
		pin.style.top = `${topPercent}%`;
		pin.setAttribute('data-name', formatName(user.display_name));

		pin.addEventListener('click', () => { openProfileModal({ id: user.id }); });

		const img = document.createElement('img');
		img.className = 'map-user-avatar';
		let optimizedAvatar = user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
		if (optimizedAvatar.includes('_400x400')) optimizedAvatar = optimizedAvatar.replace('_400x400', '_normal');

		const animDelay = rand() * 0.8;
		pin.style.animationDelay = `${animDelay}s`;
		img.src = optimizedAvatar;
		img.alt = formatName(user.display_name);
		img.onerror = () => { img.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'; };

		pin.appendChild(img);
		mapContainer.appendChild(pin);
	});
}

function closeDynamicCityMap() {
	const modal = document.getElementById('dynamicCityMapModal');
	if (!modal) return;
	modal.classList.remove('active');
	setTimeout(() => {
		modal.style.display = 'none';
		// Tum Sehirler modali hala aciksa scroll'u kilitle birak
		const allCitiesModal = document.getElementById('allCitiesModal');
		if (allCitiesModal && allCitiesModal.style.display === 'flex') {
			// Scroll kilidi devam etsin
		} else {
			unlockScroll();
		}
	}, 350);
	currentDynamicCityId = null;
	currentDynamicCityName = null;
}


/* ---- ANA SAYFAYA SEHIR EKLEME (PINLEME) ---- */

function pinCityToHomepage(cityId, cityName) {
	const order = getHomepageCityOrder();
	if (order.includes(cityId)) return; // Zaten eklenmis

	order.push(cityId);
	saveHomepageCityOrder(order);

	// Tum modallari kapat
	const dynamicModal = document.getElementById('dynamicCityMapModal');
	const allCitiesModal = document.getElementById('allCitiesModal');

	if (dynamicModal) {
		dynamicModal.classList.remove('active');
		setTimeout(() => { dynamicModal.style.display = 'none'; }, 300);
	}
	if (allCitiesModal) {
		allCitiesModal.classList.remove('active');
		setTimeout(() => { allCitiesModal.style.display = 'none'; }, 300);
	}

	// Pinned sehri ana sayfaya ekle ve renderla
	setTimeout(async () => {
		await renderSinglePinnedCity(cityId, cityName);
		applyCityVisibility();
		loadMapData(true);

		// Ayarlar modalini ac
		setTimeout(() => { openCitySettingsModal(); }, 500);
	}, 400);
}

function unpinCityFromHomepage(cityId) {
	const order = getHomepageCityOrder();
	const newOrder = order.filter(id => id !== cityId);

	// En az 1 sehir kalmali
	if (newOrder.length === 0) return;

	saveHomepageCityOrder(newOrder);

	// Container'i kaldir
	const container = document.getElementById(`cityContainer-${cityId}`);
	if (container) container.remove();

	// CITIES dizisinden kaldir (sadece pinned olanlari)
	const idx = CITIES.findIndex(c => c.id === cityId && c.isPinned);
	if (idx !== -1) CITIES.splice(idx, 1);

	// currentMapUsers'tan temizle
	delete currentMapUsers[cityId];

	applyCityVisibility();
}


/* ---- PINNED SEHIRLER ANA SAYFA RENDER ---- */

async function initPinnedCities() {
	const order = getHomepageCityOrder();
	const mapSection = document.getElementById('mapSection');
	if (!mapSection) return;

	let hasNewPinned = false;
	for (const cityId of order) {
		if (DEFAULT_CITY_IDS.includes(cityId)) continue;
		// Zaten container varsa atla
		if (document.getElementById(`cityContainer-${cityId}`)) continue;

		const cityName = getCityDisplayName(cityId);
		await renderSinglePinnedCity(cityId, cityName);
		hasNewPinned = true;
	}

	applyCityVisibility();

	// Container'lar olustuktan sonra kullanici verilerini yukle
	if (hasNewPinned) {
		await loadPinnedCityData();
	}
}

async function renderSinglePinnedCity(cityId, cityName) {
	const mapSection = document.getElementById('mapSection');
	if (!mapSection) return;
	if (document.getElementById(`cityContainer-${cityId}`)) return;

	const svgText = await fetchCitySvg(cityId);
	if (!svgText) return;

	const parsed = parseCitySvg(svgText);
	if (!parsed) return;

	ensureCityInArray(cityId, cityName, parsed.viewBox, parsed.pathsHtml);

	const vb = parsed.viewBox.split(/[\s,]+/).map(Number);
	const aspectRatio = vb[2] / vb[3];

	const container = document.createElement('div');
	container.className = 'city-container pinned-city';
	container.id = `cityContainer-${cityId}`;
	container.innerHTML = `
		<div class="city-badge">${cityName}</div>
		<div class="map-wrapper" id="mapWrapper-${cityId}" style="aspect-ratio: ${aspectRatio};">
			<svg version="1.1" id="svg-${cityId}" xmlns="http://www.w3.org/2000/svg" viewBox="${parsed.viewBox}" style="width:100%;height:100%;display:block;">
				<g id="${cityId}-paths" class="istanbul-map-group">
					${parsed.pathsHtml}
				</g>
			</svg>
			<div class="map-avatars-container" id="mapAvatarsContainer-${cityId}"></div>
		</div>
		<div class="city-footer">
			<div class="city-stats" id="cityStats-${cityId}">
				Toplam <strong id="cityTotal-${cityId}">0</strong> kullanici
			</div>
			<div class="city-controls">
				<div style="display: flex; gap: 8px; align-items: center; margin: 0 auto;">
					<button class="btn-map-action" id="btnExplore-${cityId}"></button>
				</div>
			</div>
		</div>
	`;

	mapSection.appendChild(container);

	// "Incele" butonunu bagla
	const btnExplore = document.getElementById(`btnExplore-${cityId}`);
	if (btnExplore) {
		btnExplore.innerText = `${cityName}'i Incele`;
		btnExplore.addEventListener('click', () => openDrinkersModal(cityId));
	}

	// currentMapUsers baslatma
	if (!currentMapUsers[cityId]) currentMapUsers[cityId] = [];
}

async function loadPinnedCityData() {
	const order = getHomepageCityOrder();
	const pinnedIds = order.filter(id => !DEFAULT_CITY_IDS.includes(id));
	if (pinnedIds.length === 0) return;

	try {
		const { data, error } = await supabase
			.from('public_profiles')
			.select('id, display_name, nickname, avatar_url, preferred_locations, updated_at')
			.order('updated_at', { ascending: false })
			.limit(10000);

		if (error) throw error;
		if (!data) return;

		// Pinned sehirler icin kullanicilari ayristir
		pinnedIds.forEach(cityId => {
			currentMapUsers[cityId] = [];
		});

		data.forEach(profile => {
			if (!profile.preferred_locations || !Array.isArray(profile.preferred_locations)) return;
			const groupedLocs = {};

			profile.preferred_locations.forEach(loc => {
				const parts = loc.split(',');
				const rawCity = parts[0].trim();
				const city = normalizeCityId(rawCity);
				if (pinnedIds.includes(city)) {
					if (!groupedLocs[city]) groupedLocs[city] = [];
					if (parts.length >= 2) groupedLocs[city].push(parts[1].trim());
				}
			});

			Object.keys(groupedLocs).forEach(city => {
				const distString = groupedLocs[city].length > 0 ? groupedLocs[city].join(', ') : 'Butun Sehir';
				if (!currentMapUsers[city]) currentMapUsers[city] = [];
				currentMapUsers[city].push({
					id: profile.id,
					display_name: profile.display_name,
					nickname: profile.nickname,
					avatar_url: profile.avatar_url,
					district: distString,
					updated_at: profile.updated_at
				});
			});
		});

		// Pinleri render et
		pinnedIds.forEach(cityId => {
			renderMapUsers(cityId, currentMapUsers[cityId]);
		});

	} catch (err) {
		console.error('Pinned sehir verileri yuklenemedi:', err);
	}
}


/* ---- EVENT LISTENER'LAR ---- */

document.addEventListener('DOMContentLoaded', () => {
	// Tum Sehirler butonu
	const btnAllCities = document.getElementById('btnAllCities');
	if (btnAllCities) {
		btnAllCities.addEventListener('click', () => { openAllCitiesModal(); });
	}

	// Tum Sehirler modali kapat
	const closeAllCitiesBtn = document.getElementById('closeAllCitiesBtn');
	const allCitiesModalOverlay = document.getElementById('allCitiesModalOverlay');
	if (closeAllCitiesBtn) closeAllCitiesBtn.addEventListener('click', closeAllCitiesModal);
	if (allCitiesModalOverlay) allCitiesModalOverlay.addEventListener('click', closeAllCitiesModal);

	// Dinamik Harita modali kapat
	const closeDynamicBtn = document.getElementById('closeDynamicCityMapBtn');
	const dynamicOverlay = document.getElementById('dynamicCityMapOverlay');
	if (closeDynamicBtn) closeDynamicBtn.addEventListener('click', closeDynamicCityMap);
	if (dynamicOverlay) dynamicOverlay.addEventListener('click', closeDynamicCityMap);

	// Dinamik Harita "Incele" butonu
	const btnDynamicExplore = document.getElementById('btnDynamicExplore');
	if (btnDynamicExplore) {
		btnDynamicExplore.addEventListener('click', () => {
			if (currentDynamicCityId) {
				openDrinkersModal(currentDynamicCityId);
			}
		});
	}

	// "Ana Sayfaya Ekle" butonu
	const btnPinToHomepage = document.getElementById('btnPinToHomepage');
	if (btnPinToHomepage) {
		btnPinToHomepage.addEventListener('click', () => {
			if (currentDynamicCityId && currentDynamicCityName) {
				pinCityToHomepage(currentDynamicCityId, currentDynamicCityName);
			}
		});
	}
});
