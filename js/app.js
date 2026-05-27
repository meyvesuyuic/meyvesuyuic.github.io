// Supabase'i ES Module olarak iÃ§e aktarÄ±yoruz
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

// Profil ModalÄ± ElemanlarÄ±
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

// 1. GiriÅŸ Butonu Ä°ÅŸlevi
loginBtn.addEventListener('click', async () => {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'twitter',
		options: {
			redirectTo: window.location.origin
		}
	});

	if (error) console.error("GiriÅŸ baÅŸlatÄ±lamadÄ±:", error.message);
});

// 2. Ã‡Ä±kÄ±ÅŸ Butonu Ä°ÅŸlevi
logoutBtn.addEventListener('click', async () => {
	const user = (await supabase.auth.getUser()).data.user;
	if (user) {
		localStorage.removeItem(`user_profile_${user.id}`);
	}
	const { error } = await supabase.auth.signOut();
	if (error) {
		console.error("Ã‡Ä±kÄ±ÅŸ yapÄ±lamadÄ±:", error.message);
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
		const cachedProfile = localStorage.getItem(localKey);

		if (cachedProfile) {
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
			.select('is_onboarded, display_name, nickname, avatar_url, favorite_styles, other_alcohols, preferred_locations, drinking_frequency, drinking_environment, abv_preference, drinking_snack')
			.eq('id', user.id)
			.maybeSingle();

		if (dbProfile && dbProfile.is_onboarded) {
			console.log("Kullanıcı onboard edilmiş, bilgiler yerel depolamaya yazılıyor.");
			localStorage.setItem(localKey, JSON.stringify(dbProfile));

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

// Setup mantÄ±ÄŸÄ±nÄ± yÃ¶neten sihirbaz fonksiyonu
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

	// Konum SeÃ§im DOM ElemanlarÄ±
	const citySelect = document.getElementById('citySelect');
	const districtSelect = document.getElementById('districtSelect');
	const addLocationBtn = document.getElementById('addLocationBtn');
	const selectedLocationsGroup = document.getElementById('selectedLocationsGroup');

	// Åehirleri dropdown listesine dinamik olarak doldur (81 il)
	if (citySelect) {
		citySelect.innerHTML = '<option value="" disabled selected>Åehir SeÃ§in</option>';
		// Ä°stanbul, Ankara, Ä°zmir'i baÅŸa alÄ±p diÄŸer ÅŸehirleri alfabetik sÄ±ralayalÄ±m
		const priorityCities = ["Ä°stanbul", "Ankara", "Ä°zmir"];
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
			districtSelect.innerHTML = '<option value="" disabled selected>Ä°lÃ§e SeÃ§in</option>';

			if (districtsMap[city]) {
				// BÃ¼tÃ¼n Åehir seÃ§eneÄŸini ilÃ§e listesinin baÅŸÄ±na ekle
				const allOpt = document.createElement('option');
				allOpt.value = "BÃ¼tÃ¼n Åehir";
				allOpt.innerText = "BÃ¼tÃ¼n Åehir";
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
				alert("LÃ¼tfen Ã¶nce ÅŸehir ve ilÃ§e seÃ§iniz.");
				return;
			}

			const locStr = `${city}, ${district}`;
			if (selectedLocations.includes(locStr)) {
				alert("Bu konum zaten eklenmiÅŸ.");
				return;
			}

			if (selectedLocations.length >= 3) {
				alert("En fazla 3 adet konum ekleyebilirsiniz.");
				return;
			}

			selectedLocations.push(locStr);
			renderLocations();

			// Ä°lÃ§e seÃ§imini sÄ±fÄ±rla
			if (districtSelect) {
				districtSelect.value = '';
			}
		});
	}

	// SeÃ§ilen konumlarÄ± ekrana Ã§izdir
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

	// Tekli seÃ§im deÄŸerini al
	function getPillValue(groupId) {
		const selected = document.querySelector(`#${groupId} .pill-btn.selected`);
		return selected ? selected.getAttribute('data-value') : null;
	}

	// Pill grubu tÄ±klamalarÄ±nÄ± yÃ¶net
	function initPillGroup(groupId, isMultiSelect = false) {
		const group = document.getElementById(groupId);
		if (!group) return;

		const pills = group.querySelectorAll('.pill-btn');
		pills.forEach(pill => {
			// Mevcut olay dinleyicilerini sÄ±fÄ±rlamak iÃ§in butonu kopyalÄ±yoruz
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

	// TÃ¼m seÃ§im gruplarÄ±nÄ± baÅŸlat
	initPillGroup('beerStylesGroup', true);
	initPillGroup('otherAlcoholsGroup', true);
	initPillGroup('frequencyGroup', false);
	initPillGroup('environmentGroup', false);
	initPillGroup('abvGroup', false);
	initPillGroup('snackGroup', false);

	// Ä°lerleme Ã§ubuÄŸunu gÃ¼ncelle
	function updateProgress(step) {
		const bar = document.getElementById('setupProgressBar');
		if (bar) bar.style.width = (step === 1 ? '50%' : '100%');
	}

	updateProgress(1);

	// AdÄ±m 1 DoÄŸrulama ve GeÃ§iÅŸ
	nextBtnStep1.onclick = () => {
		if (selectedLocations.length === 0) {
			alert("LÃ¼tfen en az 1 tercih edilen konum ekleyiniz.");
			return;
		}
		if (selectedBeerStyles.length === 0) {
			alert("LÃ¼tfen en az 1 favori bira tarzÄ± seÃ§iniz.");
			return;
		}
		if (selectedOtherAlcohols.length === 0) {
			alert("LÃ¼tfen diÄŸer alkol tercihlerinizi seÃ§iniz.");
			return;
		}
		const frequency = getPillValue('frequencyGroup');
		if (!frequency) {
			alert("LÃ¼tfen bira iÃ§me sÄ±klÄ±ÄŸÄ±nÄ±zÄ± seÃ§iniz.");
			return;
		}

		// AdÄ±m 2'ye geÃ§iÅŸ yap
		step1.classList.remove('active');
		step2.classList.add('active');
		updateProgress(2);
		window.scrollTo(0, 0);
	};

	// AdÄ±m 2 DoÄŸrulama ve Kaydetme
	saveProfileBtn.onclick = async () => {
		const environment = getPillValue('environmentGroup');
		if (!environment) {
			alert("LÃ¼tfen tercih ettiÄŸiniz iÃ§im ortamÄ±nÄ± seÃ§iniz.");
			return;
		}
		const abv = getPillValue('abvGroup');
		if (!abv) {
			alert("LÃ¼tfen tercih ettiÄŸiniz alkol oranÄ±nÄ± (ABV) seÃ§iniz.");
			return;
		}
		const snack = getPillValue('snackGroup');
		if (!snack) {
			alert("LÃ¼tfen biranÄ±n yanÄ±ndaki atÄ±ÅŸtÄ±rmalÄ±k tercihinizi seÃ§iniz.");
			return;
		}

		// Supabase profiles tablosunu gÃ¼ncelle
		const updateData = {
			is_onboarded: true,
			favorite_styles: selectedBeerStyles,
			other_alcohols: selectedOtherAlcohols,
			preferred_locations: selectedLocations,
			drinking_frequency: getPillValue('frequencyGroup'),
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
			alert("Profil kurulumu tamamlanÄ±rken bir hata oluÅŸtu: " + error.message);
		} else {
			console.log("Kurulum baÅŸarÄ±yla tamamlandÄ±.");

			// Yerel Ã¶nbelleÄŸe kaydet
			const localKey = `user_profile_${user.id}`;
			const localData = {
				display_name: twitterData.display_name,
				nickname: twitterData.nickname,
				avatar_url: twitterData.avatar_url,
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
			// Refresh map with the new user
			loadMapData();
		}
	};
}

// Profil modalÄ±nÄ± aÃ§ma
async function openProfileModal(user) {
	if (!user) return;
	const localKey = `user_profile_${user.id}`;
	let profileData = null;
	const cachedProfile = localStorage.getItem(localKey);

	if (cachedProfile) {
		try {
			profileData = JSON.parse(cachedProfile);
		} catch (e) { }
	}

	// EÄŸer Ã¶nbellek eksikse veritabanÄ±ndan Ã§ekelim
	if (!profileData || !profileData.favorite_styles) {
		const { data, error } = await supabase
			.from('profiles')
			.select('is_onboarded, display_name, nickname, avatar_url, favorite_styles, other_alcohols, preferred_locations, drinking_frequency, drinking_environment, abv_preference, drinking_snack')
			.eq('id', user.id)
			.maybeSingle();

		if (!error && data) {
			profileData = data;
			localStorage.setItem(localKey, JSON.stringify(data));
		}
	}

	if (!profileData) return;

	// Bilgileri yerleÅŸtir
	profileAvatarLarge.src = profileData.avatar_url || '';
	profileDisplayName.innerText = profileData.display_name || '';
	profileNickname.innerText = profileData.nickname ? `@${profileData.nickname}` : '';

	// Twitter profil butonu ayarÄ±
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
		prefLocations.innerHTML = '<span class="pref-tag">BelirtilmemiÅŸ</span>';
	}

	// Bira TarzlarÄ±
	prefBeerStyles.innerHTML = '';
	if (profileData.favorite_styles && profileData.favorite_styles.length > 0) {
		profileData.favorite_styles.forEach(style => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = style;
			prefBeerStyles.appendChild(span);
		});
	} else {
		prefBeerStyles.innerHTML = '<span class="pref-tag">BelirtilmemiÅŸ</span>';
	}

	// DiÄŸer Alkoller
	prefOtherAlcohols.innerHTML = '';

	const alcoholColors = {
		"RakÄ±": { bg: "#e0f2fe", border: "#0ea5e9", color: "#0369a1" },
		"Åarap": { bg: "#ffe4e6", border: "#f43f5e", color: "#be185d" },
		"Viski": { bg: "#fef3c7", border: "#f59e0b", color: "#b45309" },
		"Cin": { bg: "#d1fae5", border: "#10b981", color: "#047857" },
		"Votka": { bg: "#f1f5f9", border: "#64748b", color: "#475569" },
		"Tekila": { bg: "#fef9c3", border: "#eab308", color: "#a16207" },
		"Kokteyl": { bg: "#f3e8ff", border: "#a855f7", color: "#6d28d9" },
		"Ä°Ã§miyorum": { bg: "#f5f5f4", border: "#78716c", color: "#57504b" }
	};

	if (profileData.other_alcohols && profileData.other_alcohols.length > 0) {
		profileData.other_alcohols.forEach(alc => {
			const span = document.createElement('span');
			span.className = 'pref-tag';
			span.innerText = alc;

			// Her alkol seÃ§eneÄŸi iÃ§in pastel renk setini uygula
			if (alcoholColors[alc]) {
				span.style.backgroundColor = alcoholColors[alc].bg;
				span.style.borderColor = alcoholColors[alc].border;
				span.style.color = alcoholColors[alc].color;
				span.style.fontWeight = '600';
			}

			prefOtherAlcohols.appendChild(span);
		});
	} else {
		prefOtherAlcohols.innerHTML = '<span class="pref-tag">BelirtilmemiÅŸ</span>';
	}

	// Tekli seÃ§im deÄŸerleri
	prefFrequency.innerText = profileData.drinking_frequency || '-';
	prefEnvironment.innerText = profileData.drinking_environment || '-';
	prefAbv.innerText = profileData.abv_preference || '-';
	prefSnack.innerText = profileData.drinking_snack || '-';

	// Oturumu Kapat Butonu görünürlüğü (Sadece kendi profilinde göster)
	try {
		const { data: { session } } = await supabase.auth.getSession();
		const isCurrentUser = session && session.user && session.user.id === user.id;
		if (logoutBtnModal) {
			logoutBtnModal.style.display = isCurrentUser ? 'block' : 'none';
		}
	} catch (e) {
		console.error("Session check failed:", e);
	}

	// ModalÄ± gÃ¶ster
	document.body.style.overflow = 'hidden';
	profileModal.style.display = 'flex';
	setTimeout(() => {
		profileModal.classList.add('active');
	}, 10);
}

// Profil modalÄ±nÄ± kapatma
function closeProfileModal() {
	profileModal.classList.remove('active');
	setTimeout(() => {
		profileModal.style.display = 'none';
		document.body.style.overflow = '';
	}, 350);
}

// Olay dinleyicilerini baÄŸlayalÄ±m
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

// --- Istanbul Map Integration ---

const istanbulSafePoints = [
	// European Side
	{ x: 130, y: 65 }, { x: 132, y: 63 }, { x: 134, y: 62 }, { x: 134, y: 67 },
	{ x: 136, y: 60 }, { x: 136, y: 65 }, { x: 138, y: 58 }, { x: 138, y: 63 },
	{ x: 138, y: 68 }, { x: 140, y: 56 }, { x: 140, y: 61 }, { x: 140, y: 66 },
	{ x: 142, y: 55 }, { x: 142, y: 60 }, { x: 142, y: 65 }, { x: 142, y: 70 },
	{ x: 145, y: 53 }, { x: 145, y: 58 }, { x: 145, y: 63 }, { x: 145, y: 68 },
	{ x: 148, y: 55 }, { x: 148, y: 60 }, { x: 148, y: 65 }, { x: 148, y: 70 },
	{ x: 151, y: 56 }, { x: 151, y: 61 }, { x: 151, y: 66 }, { x: 151, y: 71 },
	{ x: 154, y: 58 }, { x: 154, y: 63 }, { x: 154, y: 68 }, { x: 154, y: 73 },
	{ x: 157, y: 60 }, { x: 157, y: 65 }, { x: 157, y: 70 }, { x: 157, y: 75 },
	{ x: 160, y: 62 }, { x: 160, y: 67 }, { x: 160, y: 72 }, { x: 160, y: 76 },
	{ x: 163, y: 64 }, { x: 163, y: 69 }, { x: 163, y: 74 }, { x: 163, y: 77 },
	{ x: 166, y: 65 }, { x: 166, y: 70 }, { x: 166, y: 75 }, { x: 169, y: 66 },
	{ x: 169, y: 71 }, { x: 169, y: 76 }, { x: 172, y: 67 }, { x: 172, y: 72 },
	{ x: 172, y: 75 }, { x: 175, y: 68 }, { x: 175, y: 71 },

	// Asian Side
	{ x: 185, y: 73 }, { x: 185, y: 78 }, { x: 185, y: 83 }, { x: 188, y: 72 },
	{ x: 188, y: 77 }, { x: 188, y: 82 }, { x: 188, y: 86 }, { x: 191, y: 72 },
	{ x: 191, y: 77 }, { x: 191, y: 82 }, { x: 191, y: 87 }, { x: 194, y: 73 },
	{ x: 194, y: 78 }, { x: 194, y: 83 }, { x: 194, y: 87 }, { x: 197, y: 72 },
	{ x: 197, y: 76 }, { x: 197, y: 80 }, { x: 200, y: 72 }, { x: 200, y: 76 },
	{ x: 200, y: 80 }, { x: 203, y: 73 }, { x: 203, y: 77 }, { x: 203, y: 80 },
	{ x: 206, y: 74 }, { x: 206, y: 78 }, { x: 206, y: 81 }, { x: 209, y: 75 },
	{ x: 209, y: 79 }, { x: 209, y: 82 }, { x: 212, y: 75 }, { x: 212, y: 79 },
	{ x: 212, y: 81 }, { x: 215, y: 75 }, { x: 215, y: 78 }, { x: 218, y: 76 }
];

let currentMapUsers = [];

const MAP_HTML_CONTENT = `
			<div class="map-wrapper" id="mapWrapper">
				<svg version="1.1" id="svg-istanbul" xmlns="http://www.w3.org/2000/svg" viewBox="119.881 34.497 106.166 64.114">
					<g id="istanbul-paths" class="istanbul-map-group">
						<path d="M187.613,66.733l-2.876,1.342l-2.063,2.218l0.561,1.719l0.062,0.188l-0.125,0.188l-2.002,3.78 l-0.031,0.062l-0.062,0.062l-1.657,1.78l-0.564,3l1.593,1.595l0.031,0.031l2.093,2.47l0.031,0.031l2.249,2.282l0.062,0.031 l3.499,1.877l0.156,0.094l0.062,0.156l1.03,2.439l3.593,1.533l1.376-2.53l0.031-0.094l1.221-3.937l0.657-2.156l0.031-0.188 l0.188-0.094l3.657-2.154h0.031l2.626-1.405l0.188-0.062l0.188,0.031l1.625,0.376l0.094,0.031l0.062,0.031l3.593,2.158 l2.219-0.53l3.032-1.529h0.031l2.595-1.249h0.031l3.689-2.123l0.627-2.875c-0.638-0.155-3.737-0.913-4.593-1.159 c-0.842-0.24-4.405-1.127-4.405-1.127l-7.437-1.629l-0.031-0.031h-0.031l-5.561-1.878v-0.031h-0.031l-5.624-2.347L187.613,66.733 z"></path>
						<path d="M179.76,85.166l-0.062,0.688l-0.094,0.75l1.688,0.751l0.062,0.031l0.062,0.031l2.155,1.907l0.188,0.156 l-0.031,0.25l-0.252,2.906l-0.031,0.562l-0.562-0.094l-2-0.376l-0.156-0.031l-0.095-0.092l-1.374-1.282l-0.062-0.031 l-0.031-0.031l-1.374-1.907l-0.031-0.062l-0.031-0.062l-1.029-2.907l-0.188-0.531l0.594-0.125l2-0.374L179.76,85.166z"></path>
						<path d="M136.272,39.497l-0.25,0.25l0.031,0.344l-0.344,0.031l-1.658,3.155l1.873,3.532l0.125,0.219l-0.125,0.25 l-2.408,4.53v0.031l-3.284,5.904v0.031l-4.098,6.686v0.031l-1.253,5.249l1.092,3.563l4.689-1.372h0.031h0.031l6.594-0.902h0.125 l0.125,0.031l2.874,1.158v-0.031c0,0,1.118,0.405,2.312,0.782c0.597,0.189,1.23,0.361,1.719,0.501 c0.245,0.07,0.433,0.118,0.594,0.156c0.161,0.039,0.312,0.062,0.25,0.062c0.178,0,0.291,0.05,0.438,0.094s0.321,0.088,0.5,0.156 c0.358,0.136,0.757,0.324,1.156,0.501c0.798,0.351,1.531,0.689,1.531,0.689l0.062,0.031l0.031,0.031l3.499,2.596v-0.062v-0.469 l0.469-0.031l2.656-0.124h0.406l0.094,0.406c0,0,0.122,0.564,0.249,1.219c0.105,0.539,0.182,1.038,0.218,1.469 c0.028,0.008,0.025,0.023,0.062,0.031c0.213,0.045,0.573,0.093,1,0.126c0.854,0.063,1.994,0.087,3.156,0.096 c2.325,0.017,4.656-0.059,4.656-0.059h0.219l0.125,0.125l0.781,0.656l1.312-0.718l0.094-0.031l0.094-0.031l3.188-0.248 l2.157-1.124l-0.594-0.344l-0.312-0.156l0.031-0.312l0.251-2.281l0.062-0.438h0.438l1.656,0.001h0.281l0.125,0.219l0.874,1.344 l1.782-1.249l0.626-2.719v-0.094l0.062-0.094l0.5-0.688l-0.687-2.281l-0.125-0.344l0.344-0.219l1.219-0.749l0.031-0.031 l1.439-2.03l0.062-0.094l0.532-1.219l-3.906-0.002h-0.094l-0.062-0.031l-4.311-1.502l-0.031-0.031h-0.031l-4.53-2.283 l-4.687-2.409l-5.436-2.784h-0.031l-5.529-3.534l-5.81-3.409l-0.031-0.031l-3.405-2.408h-0.031l-4.529-3.408l-0.031-0.031 l-0.031-0.031l-2.779-2.783L136.71,40.5l-0.031-0.062L136.272,39.497z"></path>
					</g>
				</svg>
				<div class="map-avatars-container" id="mapAvatarsContainer"></div>
			</div>
			<div class="map-actions">
				<button class="btn-map-action" id="btnExploreIstanbul">İstanbul'u İncele</button>
				<button class="btn-map-action" id="btnActiveDrinkers" disabled>Anlık İçicilere Bak</button>
			</div>
`;

function initMap() {
	const mapSection = document.getElementById('mapSection');
	if (!mapSection) return;

	if (!mapSection.querySelector('#mapWrapper')) {
		mapSection.innerHTML = MAP_HTML_CONTENT;

		const btnExplore = mapSection.querySelector('#btnExploreIstanbul');
		if (btnExplore) {
			btnExplore.addEventListener('click', openDrinkersModal);
		}
	}
	mapSection.style.display = 'block';
}

function clearMap() {
	const mapSection = document.getElementById('mapSection');
	if (mapSection) {
		mapSection.innerHTML = '';
		mapSection.style.display = 'none';
	}
	currentMapUsers = [];
}

async function loadMapData() {
	const { data: { session } } = await supabase.auth.getSession();
	if (!session) {
		console.warn("Yetkisiz harita yükleme girişimi engellendi.");
		clearMap();
		return;
	}

	const mapContainer = document.getElementById('mapAvatarsContainer');
	if (!mapContainer) return;

	try {
		console.log("Fetching map users from Supabase...");
		// Fetch up to 100 onboarded users, sorted by latest updates
		const { data, error } = await supabase
			.from('profiles')
			.select('id, display_name, avatar_url, preferred_locations')
			.eq('is_onboarded', true)
			.order('updated_at', { ascending: false })
			.limit(100);

		if (error) throw error;

		if (data) {
			currentMapUsers = [];
			data.forEach(profile => {
				if (profile.preferred_locations && Array.isArray(profile.preferred_locations)) {
					profile.preferred_locations.forEach(loc => {
						if (loc.startsWith('İstanbul,') || loc.startsWith('Istanbul,')) {
							const dist = loc.split(',')[1].trim();
							currentMapUsers.push({
								id: profile.id,
								display_name: profile.display_name,
								avatar_url: profile.avatar_url,
								district: dist
							});
						}
					});
				}
			});

			renderMapUsers(currentMapUsers);
		}
	} catch (err) {
		console.error("Error loading map users:", err.message);
	}
}

function renderMapUsers(users) {
	const mapContainer = document.getElementById('mapAvatarsContainer');
	if (!mapContainer) return;
	mapContainer.innerHTML = '';

	// Sort users stably by ID so their coordinates remain consistent
	const stableUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));

	// Limit to the number of safe points to prevent overlapping entirely
	const displayLimit = Math.min(stableUsers.length, istanbulSafePoints.length);

	for (let i = 0; i < displayLimit; i++) {
		const user = stableUsers[i];
		const coords = istanbulSafePoints[i];

		// Convert SVG coordinates to percentages of viewBox (119.881 34.497 106.166 64.114)
		const leftPercent = ((coords.x - 119.881) / 106.166) * 100;
		const topPercent = ((coords.y - 34.497) / 64.114) * 100;

		const pin = document.createElement('div');
		pin.className = 'map-user-pin';
		pin.style.left = `${leftPercent}%`;
		pin.style.top = `${topPercent}%`;
		pin.setAttribute('data-name', user.display_name);

		// Click opens that user's profile directly
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
	}
}

// Drinkers Bottom Sheet Modal Handlers
function openDrinkersModal() {
	const modal = document.getElementById('drinkersModal');
	const container = document.getElementById('drinkersListContainer');
	if (!modal || !container) return;

	container.innerHTML = '';

	if (currentMapUsers.length === 0) {
		container.innerHTML = '<p style="text-align: center; color: var(--secondary-text); margin-top: 20px;">Henüz İstanbul\'da kayıtlı birasever bulunmuyor.</p>';
	} else {
		currentMapUsers.forEach(user => {
			const item = document.createElement('div');
			item.className = 'drinker-item';
			item.innerHTML = `
				<div class="drinker-avatar-wrapper">
					<img class="drinker-avatar" src="${user.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}" alt="${user.display_name}">
				</div>
				<div class="drinker-info">
					<span class="drinker-name">${user.display_name}</span>
					<span class="drinker-location">${user.district}</span>
				</div>
			`;

			// Handle broken image
			item.querySelector('.drinker-avatar').onerror = (e) => {
				e.target.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
			};

			container.appendChild(item);
		});
	}

	// Show modal
	document.body.style.overflow = 'hidden';
	modal.style.display = 'flex';
	setTimeout(() => {
		modal.classList.add('active');
	}, 10);
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
