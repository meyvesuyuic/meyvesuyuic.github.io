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
		} else {
			// Onboard edilmemiş veya kaydı yok!
			console.log("Kullanıcı kurulum ekranını tamamlamamış. Setup ekranı açılıyor.");
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex'; // Profil bilgilerinin görünmesi için
			document.getElementById('setupScreen').style.display = 'flex';

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
		// İstanbul, Ankara, İzmir'i başa alıp diğer şehirleri alfabetik sıralayalım
		const priorityCities = ["İstanbul", "Ankara", "İzmir"];
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

	// Şehir seçildiğinde ilçeleri doldur
	if (citySelect && districtSelect) {
		citySelect.addEventListener('change', () => {
			const city = citySelect.value;
			districtSelect.innerHTML = '<option value="" disabled selected>İlçe Seçin</option>';
			
			if (districtsMap[city]) {
				// Bütün Şehir seçeneğini ilçe listesinin başına ekle
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
		const frequency = getPillValue('frequencyGroup');
		if (!frequency) {
			alert("Lütfen bira içme sıklığınızı seçiniz.");
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

		// Supabase profiles tablosunu güncelle
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
			alert("Profil kurulumu tamamlanırken bir hata oluştu: " + error.message);
		} else {
			console.log("Kurulum başarıyla tamamlandı.");

			// Yerel önbelleğe kaydet
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
		}
	};
}

// Profil modalını açma
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
	
	// Eğer önbellek eksikse veritabanından çekelim
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
	
	// Bilgileri yerleştir
	profileAvatarLarge.src = profileData.avatar_url || '';
	profileDisplayName.innerText = profileData.display_name || '';
	profileNickname.innerText = profileData.nickname ? `@${profileData.nickname}` : '';
	
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
	
	// Modalı göster
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