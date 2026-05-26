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
			document.getElementById('dashboardScreen').style.display = 'none';
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
					document.getElementById('dashboardScreen').style.display = 'block';
					loadDashboard(user);
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
			document.getElementById('dashboardScreen').style.display = 'block';
			loadDashboard(user);
		} else {
			// Onboard edilmemiş veya kaydı yok!
			console.log("Kullanıcı kurulum ekranını tamamlamamış. Setup ekranı açılıyor.");
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex'; // Profil bilgilerinin görünmesi için
			document.getElementById('setupScreen').style.display = 'flex';
			document.getElementById('dashboardScreen').style.display = 'none';

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
		document.getElementById('dashboardScreen').style.display = 'none';
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
			document.getElementById('dashboardScreen').style.display = 'block';
			loadDashboard(user);
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
		} catch (e) {}
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

// ==========================================
// Şehir Kartları & Avatar Eşleştirme Haritası
// ==========================================

const citySlots = {
	'istanbul': [
		{ x: 155, y: 60 },
		{ x: 200, y: 75 },
		{ x: 175, y: 65 },
		{ x: 140, y: 55 },
		{ x: 185, y: 70 },
		{ x: 215, y: 78 },
		{ x: 165, y: 50 },
		{ x: 150, y: 48 }
	],
	'ankara': [
		{ x: 340, y: 170 },
		{ x: 310, y: 150 },
		{ x: 380, y: 180 },
		{ x: 350, y: 210 },
		{ x: 320, y: 200 },
		{ x: 390, y: 140 },
		{ x: 290, y: 170 },
		{ x: 360, y: 130 }
	],
	'izmir': [
		{ x: 75, y: 240 },
		{ x: 95, y: 255 },
		{ x: 65, y: 210 },
		{ x: 50, y: 250 },
		{ x: 105, y: 220 },
		{ x: 80, y: 270 },
		{ x: 40, y: 200 },
		{ x: 115, y: 245 }
	],
	'eskisehir': [
		{ x: 275, y: 180 },
		{ x: 250, y: 165 },
		{ x: 300, y: 190 },
		{ x: 285, y: 160 },
		{ x: 245, y: 185 },
		{ x: 315, y: 180 },
		{ x: 265, y: 150 },
		{ x: 290, y: 205 }
	]
};

const maxUsersConfig = {
	'istanbul': 6,
	'ankara': 6,
	'izmir': 5,
	'eskisehir': 5
};

const cityCodeMap = {
	'istanbul': '34',
	'ankara': '06',
	'izmir': '35',
	'eskisehir': '26'
};

const phoneCodeMap = {
	'istanbul': '212',
	'ankara': '312',
	'izmir': '232',
	'eskisehir': '222'
};

// Crop & render each city SVG card
async function renderCityCard(cityId, cityName, users) {
	const card = document.createElement('div');
	card.className = 'city-card';

	const response = await fetch(`/cities/${cityId}.svg`);
	const svgText = await response.text();

	// Parse SVG XML content
	const parser = new DOMParser();
	const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
	const svgElement = svgDoc.querySelector('svg');

	// Add defs and clipPath for circle avatar cropping
	let defs = svgElement.querySelector('defs');
	if (!defs) {
		defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		svgElement.insertBefore(defs, svgElement.firstChild);
	}

	const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
	clipPath.setAttribute('id', 'circle-clip');
	clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
	clipPath.innerHTML = '<circle cx="0.5" cy="0.5" r="0.5" />';
	defs.appendChild(clipPath);

	const cityGroup = svgElement.querySelector('g');

	const slots = citySlots[cityId] || [];
	const maxUsers = maxUsersConfig[cityId] || 6;

	const displayCount = Math.min(users.length, maxUsers);
	const hasMore = users.length > maxUsers;
	const loopLimit = hasMore ? maxUsers - 1 : displayCount;

	// Render user avatars in their corresponding map slots
	for (let i = 0; i < loopLimit; i++) {
		const user = users[i];
		const slot = slots[i];
		if (!slot) break;

		// Create a group for hover transitions centered on the slot
		const avatarGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		avatarGroup.setAttribute('class', 'avatar-group');
		avatarGroup.style.cursor = 'pointer';
		avatarGroup.style.transformOrigin = `${slot.x}px ${slot.y}px`;

		// SVG image element
		const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
		img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', user.avatar_url);
		const size = 26; // Avatar size
		img.setAttribute('x', slot.x - size / 2);
		img.setAttribute('y', slot.y - size / 2);
		img.setAttribute('width', size);
		img.setAttribute('height', size);
		img.setAttribute('clip-path', 'url(#circle-clip)');

		// White border circle centered around the avatar image
		const borderCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		borderCircle.setAttribute('cx', slot.x);
		borderCircle.setAttribute('cy', slot.y);
		borderCircle.setAttribute('r', size / 2);
		borderCircle.setAttribute('fill', 'none');
		borderCircle.setAttribute('stroke', '#ffffff');
		borderCircle.setAttribute('stroke-width', '1.5');
		borderCircle.setAttribute('class', 'avatar-border');

		// Tooltip name display
		const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
		title.textContent = `${user.display_name} (@${user.nickname})`;

		avatarGroup.appendChild(img);
		avatarGroup.appendChild(borderCircle);
		avatarGroup.appendChild(title);

		avatarGroup.addEventListener('click', () => {
			openProfileModal(user);
		});

		cityGroup.appendChild(avatarGroup);
	}

	// Render remaining count badge if users list exceed limit
	if (hasMore) {
		const slot = slots[maxUsers - 1];
		if (slot) {
			const size = 26;
			const remainingCount = users.length - (maxUsers - 1);

			const badgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			badgeGroup.setAttribute('class', 'avatar-badge-group');
			badgeGroup.style.cursor = 'pointer';
			badgeGroup.style.transformOrigin = `${slot.x}px ${slot.y}px`;

			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', slot.x);
			circle.setAttribute('cy', slot.y);
			circle.setAttribute('r', size / 2);
			circle.setAttribute('fill', '#1f2937'); // Charcoal grey background
			circle.setAttribute('stroke', '#ffffff');
			circle.setAttribute('stroke-width', '1.5');
			circle.setAttribute('class', 'avatar-border');

			const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			text.setAttribute('x', slot.x);
			text.setAttribute('y', slot.y);
			text.setAttribute('fill', '#ffffff');
			text.setAttribute('font-size', '9px');
			text.setAttribute('font-weight', 'bold');
			text.setAttribute('text-anchor', 'middle');
			text.setAttribute('dominant-baseline', 'central');
			text.textContent = `+${remainingCount}`;

			const otherUserNames = users.slice(maxUsers - 1).map(u => u.display_name).join(', ');
			const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
			title.textContent = `Ve diğer ${remainingCount} kişi: ${otherUserNames}`;

			badgeGroup.appendChild(circle);
			badgeGroup.appendChild(text);
			badgeGroup.appendChild(title);

			cityGroup.appendChild(badgeGroup);
		}
	}

	// Construct card content layout
	card.innerHTML = `
		<div class="city-card-header">
			<div class="city-card-title-group">
				<span class="city-card-code">${cityCodeMap[cityId]}</span>
				<div>
					<h4 class="city-card-name">${cityName}</h4>
					<p class="city-card-subtitle">Telefon Kodu: 0${phoneCodeMap[cityId]}</p>
				</div>
			</div>
			<div class="city-card-stats">
				<span class="stats-count">${users.length}</span>
				<span class="stats-label">Aktif</span>
			</div>
		</div>
		<div class="city-card-map-wrapper">
			<!-- SVG map is injected here -->
		</div>
	`;

	card.querySelector('.city-card-map-wrapper').appendChild(svgElement);
	return card;
}

// Load and aggregate dashboard data
async function loadDashboard(currentUser) {
	const dashboardScreen = document.getElementById('dashboardScreen');
	const cityCardsList = document.getElementById('cityCardsList');
	if (!dashboardScreen || !cityCardsList) return;

	cityCardsList.innerHTML = '<div class="loading-spinner-wrapper"><span class="loading-spinner"></span><p>Şehirler ve kullanıcılar yükleniyor...</p></div>';

	try {
		// Fetch all onboarded profiles from database
		const { data: dbUsers, error } = await supabase
			.from('profiles')
			.select('id, display_name, nickname, avatar_url, preferred_locations')
			.eq('is_onboarded', true);

		let usersList = dbUsers || [];

		// Ensure current user is present
		const localKey = `user_profile_${currentUser.id}`;
		const cachedProfileStr = localStorage.getItem(localKey);
		if (cachedProfileStr) {
			const cachedProfile = JSON.parse(cachedProfileStr);
			if (!usersList.some(u => u.id === currentUser.id)) {
				usersList.push({
					id: currentUser.id,
					display_name: cachedProfile.display_name,
					nickname: cachedProfile.nickname,
					avatar_url: cachedProfile.avatar_url,
					preferred_locations: cachedProfile.preferred_locations
				});
			}
		}

		// Mock profiles to ensure visually pleasing maps
		const mockAvatars = [
			'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=150&h=150&q=80',
			'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80'
		];

		const mockUsersData = [
			{ id: 'm1', display_name: 'Buse Demir', nickname: 'busedemir', avatar_url: mockAvatars[0], preferred_locations: ['İstanbul, Kadıköy'] },
			{ id: 'm2', display_name: 'Can Yılmaz', nickname: 'canyilmaz', avatar_url: mockAvatars[1], preferred_locations: ['Ankara, Çankaya'] },
			{ id: 'm3', display_name: 'Ezgi Kara', nickname: 'ezgikara', avatar_url: mockAvatars[2], preferred_locations: ['İzmir, Bornova'] },
			{ id: 'm4', display_name: 'Mert Aksoy', nickname: 'mertaksoy', avatar_url: mockAvatars[3], preferred_locations: ['Eskişehir, Tepebaşı'] },
			{ id: 'm5', display_name: 'Zeynep Çelik', nickname: 'zeynepcelik', avatar_url: mockAvatars[4], preferred_locations: ['İstanbul, Beşiktaş'] },
			{ id: 'm6', display_name: 'Alican Şen', nickname: 'alicansen', avatar_url: mockAvatars[5], preferred_locations: ['Ankara, Keçiören'] },
			{ id: 'm7', display_name: 'Elif Kaya', nickname: 'elifkaya', avatar_url: mockAvatars[6], preferred_locations: ['İzmir, Karşıyaka'] },
			{ id: 'm8', display_name: 'Kaan Öztürk', nickname: 'kaanozturk', avatar_url: mockAvatars[7], preferred_locations: ['Eskişehir, Odunpazarı'] },
			{ id: 'm9', display_name: 'Melis Arslan', nickname: 'melisarslan', avatar_url: mockAvatars[8], preferred_locations: ['İstanbul, Şişli'] },
			{ id: 'm10', display_name: 'Oğuzhan Kaya', nickname: 'oguzhankaya', avatar_url: mockAvatars[9], preferred_locations: ['Ankara, Yenimahalle'] },
			{ id: 'm11', display_name: 'Selin Yıldız', nickname: 'selinyildiz', avatar_url: mockAvatars[10], preferred_locations: ['İstanbul, Üsküdar'] },
			{ id: 'm12', display_name: 'Barış Bulut', nickname: 'barisbulut', avatar_url: mockAvatars[11], preferred_locations: ['İzmir, Konak'] },
			{ id: 'm13', display_name: 'Damla Koç', nickname: 'damlakoc', avatar_url: mockAvatars[12], preferred_locations: ['İstanbul, Beyoğlu'] },
			{ id: 'm14', display_name: 'Volkan Şahin', nickname: 'volkansahin', avatar_url: mockAvatars[13], preferred_locations: ['Ankara, Mamak'] },
			{ id: 'm15', display_name: 'Serkan Kurt', nickname: 'serkankurt', avatar_url: mockAvatars[14], preferred_locations: ['Eskişehir, Merkez'] }
		];

		const allUsers = [...usersList];
		for (const mockUser of mockUsersData) {
			if (!allUsers.some(u => u.nickname === mockUser.nickname)) {
				allUsers.push(mockUser);
			}
		}

		// Filter users into city lists
		const cityUsers = {
			'istanbul': [],
			'ankara': [],
			'izmir': [],
			'eskisehir': []
		};

		for (const user of allUsers) {
			if (!user.preferred_locations) continue;
			for (const loc of user.preferred_locations) {
				if (loc.startsWith('İstanbul')) {
					if (!cityUsers['istanbul'].some(u => u.id === user.id)) {
						cityUsers['istanbul'].push(user);
					}
				} else if (loc.startsWith('Ankara')) {
					if (!cityUsers['ankara'].some(u => u.id === user.id)) {
						cityUsers['ankara'].push(user);
					}
				} else if (loc.startsWith('İzmir')) {
					if (!cityUsers['izmir'].some(u => u.id === user.id)) {
						cityUsers['izmir'].push(user);
					}
				} else if (loc.startsWith('Eskişehir')) {
					if (!cityUsers['eskisehir'].some(u => u.id === user.id)) {
						cityUsers['eskisehir'].push(user);
					}
				}
			}
		}

		cityCardsList.innerHTML = '';

		const citiesToRender = [
			{ id: 'istanbul', name: 'İstanbul' },
			{ id: 'ankara', name: 'Ankara' },
			{ id: 'izmir', name: 'İzmir' },
			{ id: 'eskisehir', name: 'Eskişehir' }
		];

		for (const city of citiesToRender) {
			const usersInCity = cityUsers[city.id];
			const cardElement = await renderCityCard(city.id, city.name, usersInCity);
			cityCardsList.appendChild(cardElement);
		}

	} catch (e) {
		console.error("Dashboard loading error:", e);
		cityCardsList.innerHTML = '<div class="error">Şehirler yüklenirken bir hata oluştu.</div>';
	}
}
