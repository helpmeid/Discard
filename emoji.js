"use strict";

// Emoji picker plus ":name" shortcodes. Exposes window.discardEmoji.
(() => {
  const raw = `smile 😄|grin 😁|joy 😂|rofl 🤣|smiley 😃|wink 😉|blush 😊|heart_eyes 😍|kiss 😘|yum 😋|stuck_out_tongue 😛|zany 🤪|thinking 🤔|shush 🤫|neutral 😐|expressionless 😑|smirk 😏|unamused 😒|roll_eyes 🙄|grimace 😬|relieved 😌|pensive 😔|sleepy 😪|sleeping 😴|drool 🤤|mask 😷|sick 🤢|vomit 🤮|hot 🥵|cold 🥶|dizzy 😵|exploding_head 🤯|cowboy 🤠|party 🥳|sunglasses 😎|nerd 🤓|confused 😕|worried 😟|frown 🙁|open_mouth 😮|astonished 😲|flushed 😳|pleading 🥺|cry 😢|sob 😭|scream 😱|fearful 😨|angry 😠|rage 😡|cursing 🤬|smiling_imp 😈|skull 💀|poop 💩|clown 🤡|ghost 👻|alien 👽|robot 🤖|cat 😺|see_no_evil 🙈|hear_no_evil 🙉|speak_no_evil 🙊|hug 🤗|salute 🫡|melting 🫠|holding_back_tears 🥹|upside_down 🙃|angel 😇|money_mouth 🤑|zipper_mouth 🤐|yawn 🥱|sweat_smile 😅|laughing 😆|slight_smile 🙂|relaxed ☺️|woozy 🥴|monocle 🧐|partying_face 🥳|innocent 😇|
thumbsup 👍|thumbsdown 👎|ok_hand 👌|victory ✌️|crossed_fingers 🤞|love_you 🤟|metal 🤘|call_me 🤙|point_left 👈|point_right 👉|point_up 👆|point_down 👇|middle_finger 🖕|fist ✊|punch 👊|wave 👋|clap 👏|raised_hands 🙌|open_hands 👐|pray 🙏|handshake 🤝|muscle 💪|writing_hand ✍️|nail_care 💅|eyes 👀|eye 👁️|brain 🧠|tongue 👅|lips 👄|ear 👂|nose 👃|baby 👶|boy 👦|girl 👧|man 👨|woman 👩|older_man 👴|older_woman 👵|
heart ❤️|orange_heart 🧡|yellow_heart 💛|green_heart 💚|blue_heart 💙|purple_heart 💜|black_heart 🖤|white_heart 🤍|brown_heart 🤎|broken_heart 💔|sparkling_heart 💖|two_hearts 💕|heartbeat 💓|revolving_hearts 💞|cupid 💘|gift_heart 💝|heart_exclamation ❣️|100 💯|anger 💢|boom 💥|dizzy_star 💫|sweat_drops 💦|dash 💨|hole 🕳️|bomb 💣|speech_balloon 💬|thought_balloon 💭|zzz 💤|
dog 🐶|cat_face 🐱|mouse 🐭|hamster 🐹|rabbit 🐰|fox 🦊|bear 🐻|panda 🐼|koala 🐨|tiger 🐯|lion 🦁|cow 🐮|pig 🐷|frog 🐸|monkey 🐵|chicken 🐔|penguin 🐧|bird 🐦|duck 🦆|eagle 🦅|owl 🦉|bat 🦇|wolf 🐺|horse 🐴|unicorn 🦄|bee 🐝|bug 🐛|butterfly 🦋|snail 🐌|ladybug 🐞|ant 🐜|spider 🕷️|turtle 🐢|snake 🐍|lizard 🦎|octopus 🐙|squid 🦑|shrimp 🦐|crab 🦀|fish 🐟|tropical_fish 🐠|dolphin 🐬|whale 🐳|shark 🦈|crocodile 🐊|elephant 🐘|giraffe 🦒|gorilla 🦍|dinosaur 🦖|dragon 🐉|rose 🌹|sunflower 🌻|tulip 🌷|blossom 🌼|cherry_blossom 🌸|cactus 🌵|tree 🌳|palm_tree 🌴|evergreen 🌲|four_leaf_clover 🍀|maple_leaf 🍁|mushroom 🍄|
apple 🍎|green_apple 🍏|banana 🍌|orange 🍊|lemon 🍋|watermelon 🍉|grapes 🍇|strawberry 🍓|blueberries 🫐|cherries 🍒|peach 🍑|mango 🥭|pineapple 🍍|coconut 🥥|kiwi 🥝|tomato 🍅|avocado 🥑|eggplant 🍆|potato 🥔|carrot 🥕|corn 🌽|hot_pepper 🌶️|garlic 🧄|onion 🧅|broccoli 🥦|bread 🍞|croissant 🥐|cheese 🧀|egg 🥚|bacon 🥓|steak 🥩|poultry_leg 🍗|hamburger 🍔|fries 🍟|pizza 🍕|hotdog 🌭|sandwich 🥪|taco 🌮|burrito 🌯|ramen 🍜|spaghetti 🍝|sushi 🍣|rice 🍚|curry 🍛|dumpling 🥟|popcorn 🍿|doughnut 🍩|cookie 🍪|cake 🎂|cupcake 🧁|pie 🥧|chocolate 🍫|candy 🍬|lollipop 🍭|ice_cream 🍦|shaved_ice 🍧|honey 🍯|milk 🥛|coffee ☕|tea 🍵|beer 🍺|beers 🍻|wine 🍷|cocktail 🍸|champagne 🍾|cup_with_straw 🥤|boba 🧋|
soccer ⚽|basketball 🏀|football 🏈|baseball ⚾|tennis 🎾|volleyball 🏐|8ball 🎱|ping_pong 🏓|bowling 🎳|golf ⛳|dart 🎯|video_game 🎮|joystick 🕹️|dice 🎲|chess ♟️|puzzle 🧩|trophy 🏆|medal 🏅|first_place 🥇|second_place 🥈|third_place 🥉|guitar 🎸|piano 🎹|drum 🥁|microphone 🎤|headphones 🎧|music 🎵|notes 🎶|art 🎨|clapper 🎬|ticket 🎫|
car 🚗|taxi 🚕|bus 🚌|racecar 🏎️|police_car 🚓|ambulance 🚑|fire_engine 🚒|truck 🚚|bike 🚲|motorcycle 🏍️|train 🚆|airplane ✈️|rocket 🚀|ufo 🛸|helicopter 🚁|boat ⛵|ship 🚢|anchor ⚓|house 🏠|office 🏢|castle 🏰|tent ⛺|mountain ⛰️|volcano 🌋|beach 🏖️|island 🏝️|earth 🌍|moon 🌙|full_moon 🌕|sun ☀️|star ⭐|glowing_star 🌟|sparkles ✨|cloud ☁️|rain 🌧️|snowflake ❄️|snowman ⛄|lightning ⚡|fire 🔥|rainbow 🌈|umbrella ☂️|ocean 🌊|comet ☄️|
watch ⌚|phone 📱|computer 💻|keyboard ⌨️|desktop 🖥️|printer 🖨️|camera 📷|video_camera 📹|tv 📺|radio 📻|battery 🔋|bulb 💡|flashlight 🔦|candle 🕯️|money 💵|moneybag 💰|gem 💎|credit_card 💳|key 🔑|lock 🔒|unlock 🔓|hammer 🔨|wrench 🔧|gear ⚙️|magnet 🧲|pill 💊|syringe 💉|dna 🧬|microscope 🔬|telescope 🔭|satellite 📡|envelope ✉️|package 📦|mailbox 📫|pencil ✏️|pen 🖊️|book 📖|books 📚|newspaper 📰|bookmark 🔖|paperclip 📎|scissors ✂️|calendar 📅|clipboard 📋|chart 📈|crystal_ball 🔮|balloon 🎈|tada 🎉|confetti 🎊|gift 🎁|ribbon 🎀|crown 👑|ring 💍|lipstick 💄|tshirt 👕|jeans 👖|dress 👗|sneaker 👟|boot 👢|hat 🎩|cap 🧢|glasses 👓|backpack 🎒|bell 🔔|loudspeaker 📢|
check ✅|x ❌|warning ⚠️|no_entry ⛔|question ❓|exclamation ❗|bangbang ‼️|interrobang ⁉️|plus ➕|minus ➖|infinity ♾️|recycle ♻️|peace ☮️|yin_yang ☯️|star_of_david ✡️|cross ✝️|om 🕉️|fleur_de_lis ⚜️|trident 🔱|arrow_right ➡️|arrow_left ⬅️|arrow_up ⬆️|arrow_down ⬇️|repeat 🔁|new 🆕|free 🆓|cool 🆒|ok 🆗|sos 🆘|up 🆙|top 🔝|soon 🔜|red_circle 🔴|orange_circle 🟠|yellow_circle 🟡|green_circle 🟢|blue_circle 🔵|purple_circle 🟣|black_circle ⚫|white_circle ⚪|red_square 🟥|blue_square 🟦|green_square 🟩|checkered_flag 🏁|white_flag 🏳️|pirate_flag 🏴‍☠️|rainbow_flag 🏳️‍🌈`;

  const list = raw.split("|").map(item => item.trim()).filter(Boolean).map(item => {
    const space = item.indexOf(" ");
    return { name: item.slice(0, space), char: item.slice(space + 1) };
  });
  const byName = new Map(list.map(item => [item.name, item.char]));

  const search = query => {
    const text = query.toLowerCase().replace(/^:/, "").replace(/\s+/g, "_");
    if (!text) return list;
    const starts = list.filter(item => item.name.startsWith(text));
    const contains = list.filter(item => !item.name.startsWith(text) && item.name.includes(text));
    return [...starts, ...contains];
  };

  // Turns completed ":name:" shortcodes into their emoji; unknown names are left alone.
  const replaceShortcodes = text => text.replace(/:([a-z0-9_+-]{1,32}):/gi, (match, name) => byName.get(name.toLowerCase()) || match);

  window.discardEmoji = { list, search, replaceShortcodes };
})();
