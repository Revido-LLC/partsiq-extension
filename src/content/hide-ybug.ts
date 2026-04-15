const style = document.createElement('style');
style.textContent = '#__ybug-launcher, [id^="__ybug"] { display: none !important; }';
(document.head ?? document.documentElement).appendChild(style);
