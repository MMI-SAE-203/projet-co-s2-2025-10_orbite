import PocketBase from "pocketbase"

export const prerender = false

export async function POST({ request }) {
  try {
    const data = await request.json()
    const { orbitType } = data

    console.log("🌟 Tentative de déblocage d'orbite:", { orbitType })

    const pb = new PocketBase("http://127.0.0.1:8090")

    // Vérifier l'authentification
    if (!pb.authStore.isValid) {
      // Essayer de récupérer le token depuis les headers
      const authHeader = request.headers.get("authorization")
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "")
        try {
          // Valider le token avec PocketBase
          pb.authStore.save(token, null)
          await pb.collection("users").authRefresh()
        } catch (authError) {
          console.error("❌ Token invalide:", authError)
          return new Response(
            JSON.stringify({
              success: false,
              message: "Token d'authentification invalide",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Non authentifié - token manquant",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    }

    // Récupérer l'utilisateur authentifié
    const currentUser = pb.authStore.model
    if (!currentUser || !currentUser.id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Utilisateur non trouvé dans le token",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const userId = currentUser.id
    console.log("👤 Utilisateur authentifié:", currentUser.username || currentUser.email, "ID:", userId)

    // Récupérer les données utilisateur fraîches
    const user = await pb.collection("users").getOne(userId)
    console.log("📊 Données utilisateur fraîches:", user)

    // Calculer les points totaux
    console.log("📊 Calcul des points totaux...")

    // Récupérer les événements créés par l'utilisateur
    const userEvents = await pb.collection("event").getFullList({
      filter: `users = "${userId}"`,
      sort: "-created",
    })
    const creationPoints = userEvents.length * 10
    console.log("🎯 Points de création:", creationPoints, "(", userEvents.length, "événements )")

    // Récupérer les participations de l'utilisateur
    const participations = await pb.collection("event").getFullList({
      filter: `participe ~ "${userId}"`,
      sort: "-date_event",
    })
    const participationPoints = participations.length * 10
    console.log("🎭 Points de participation:", participationPoints, "(", participations.length, "participations )")

    // Total des points gagnés
    const totalPoints = creationPoints + participationPoints
    console.log("💰 Total points gagnés:", totalPoints)

    // Seuils de déblocage des orbites
    const orbitThresholds = {
      mercure: 100,
      venus: 200,
      terre: 400,
      mars: 600,
    }

    const requiredPoints = orbitThresholds[orbitType]
    if (!requiredPoints) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Type d'orbite invalide",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Vérifier si l'utilisateur a assez de points pour débloquer cette orbite
    if (totalPoints < requiredPoints) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Niveau insuffisant. Vous avez ${totalPoints} points, il en faut ${requiredPoints} pour débloquer ${getOrbitName(orbitType)}.`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Récupérer les orbites déjà débloquées
    let ownedOrbits = []
    try {
      if (Array.isArray(user.owned_orbits)) {
        ownedOrbits = user.owned_orbits
      } else if (typeof user.owned_orbits === "string" && user.owned_orbits) {
        ownedOrbits = JSON.parse(user.owned_orbits)
      } else {
        ownedOrbits = []
      }
    } catch (e) {
      console.warn("⚠️ Erreur parsing owned_orbits, initialisation à []:", e.message)
      ownedOrbits = []
    }

    console.log("🛍️ Orbites actuellement débloquées:", ownedOrbits)

    // Vérifier si l'utilisateur possède déjà cette orbite
    if (ownedOrbits.includes(orbitType)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Vous avez déjà débloqué cette orbite !",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Débloquer la nouvelle orbite
    ownedOrbits.push(orbitType)
    console.log("🆕 Nouvelles orbites débloquées:", ownedOrbits)

    // Mettre à jour l'utilisateur
    const updateData = {
      owned_orbits: ownedOrbits,
    }

    // Si c'est la première orbite, l'équiper automatiquement
    if (!user.equipped_orbit && orbitType !== "default") {
      updateData.equipped_orbit = orbitType
      console.log("🎯 Première orbite, équipement automatique:", orbitType)
    }

    console.log("📝 Données à mettre à jour:", updateData)

    await pb.collection("users").update(userId, updateData)

    console.log("✅ Orbite débloquée avec succès:", {
      orbitType,
      pointsRequis: requiredPoints,
      pointsUtilisateur: totalPoints,
      orbitesTotal: ownedOrbits.length,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `🎉 ${getOrbitName(orbitType)} débloqué ! Niveau atteint : ${requiredPoints} points.`,
        totalPoints,
        ownedOrbits,
        equippedOrbit: updateData.equipped_orbit || user.equipped_orbit || "",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("❌ Erreur lors du déblocage:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur lors du déblocage",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

function getOrbitName(orbitType) {
  const names = {
    mercure: "Orbite Mercure",
    venus: "Orbite Vénus",
    terre: "Orbite Terre",
    mars: "Orbite Mars",
  }
  return names[orbitType] || "Orbite"
}
