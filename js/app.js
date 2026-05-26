// Supabase'i ES Module olarak içe aktarıyoruz
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qryjfafoimjcwcuruzah.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mYbPrK4EDrlByE_ziop0Ug_nY_wjwaz';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');

const userContainer = document.getElementById('userContainer');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const logoutBtn = document.getElementById('logoutBtn');

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
	document.documentElement.classList.remove('preload-logged-in', 'preload-logged-out');

	if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
		if (!session) {
			loginBtn.style.display = 'flex';
			userContainer.style.display = 'none';
			return;
		}

		const user = session.user;
		const localKey = `user_profile_${user.id}`;
		const cachedProfile = localStorage.getItem(localKey);

		if (cachedProfile) {
			try {
				const profileData = JSON.parse(cachedProfile);
				console.log("Kullanıcı bilgileri lokal depolamadan yüklendi, DB sorgusu atlanıyor:", profileData);
				// Arayüzü güncelle
				userName.innerText = profileData.display_name;
				userAvatar.src = profileData.avatar_url;
				loginBtn.style.display = 'none';
				userContainer.style.display = 'flex';
				return;
			} catch (e) {
				console.error("Lokal profil verisi parse edilemedi, DB'ye sorgu atılacak.", e);
			}
		}

		const metadata = user.user_metadata;

		// 400x400 piksellik optimize kalite
		let betterAvatar = metadata.avatar_url ? metadata.avatar_url.replace('_normal', '_400x400') : '';

		const twitterData = {
			id: user.id,
			twitter_id: metadata.provider_id || metadata.sub,
			nickname: metadata.preferred_username || metadata.user_name,
			display_name: metadata.name || metadata.full_name,
			avatar_url: betterAvatar,
			updated_at: new Date().toISOString()
		};

		console.log("Supabase'e gönderilen veri:", twitterData);

		// Veriyi public.profiles tablosuna upsert ediyoruz
		const { error } = await supabase
			.from('profiles')
			.upsert(twitterData, { onConflict: 'id' });

		if (error) {
			console.error("Tabloya yazma başarısız. Hata kodu:", error.code, "Detay:", error.message);
		} else {
			console.log("Kullanıcı başarıyla tabloya eklendi/güncellendi.");
			
			// Bilgileri yerel depolamaya (localStorage) kaydediyoruz
			const localData = {
				display_name: twitterData.display_name,
				nickname: twitterData.nickname,
				avatar_url: twitterData.avatar_url
			};
			localStorage.setItem(localKey, JSON.stringify(localData));

			// Arayüzü güncelle
			userName.innerText = twitterData.display_name;
			userAvatar.src = twitterData.avatar_url;
			loginBtn.style.display = 'none';
			userContainer.style.display = 'flex';
		}
	} else if (event === 'SIGNED_OUT') {
		loginBtn.style.display = 'flex';
		userContainer.style.display = 'none';
		userName.innerText = '';
		userAvatar.src = '';
	}
});

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