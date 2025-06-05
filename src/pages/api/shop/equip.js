import PocketBase from "pocketbase"

export const prerender = false

export async function POST({ request }) {
  try {
    const data = await request.json()
    const { orbitType } = data

    console.log("⚙️ Tentative d'équipement:", { orbitType })

    const pb = new PocketBase('https://pocketbaseprojet.alexandre-demling.fr')

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

    // ✅ CORRECTION : Récupérer les données utilisateur FRAÎCHES depuis la base
    const user = await pb.collection("users").getOne(userId)
    console.log("📊 Données utilisateur fraîches:", user)

    // ✅ CORRECTION : Récupérer les orbites possédées (gérer les deux formats)
    let ownedOrbits = []
    try {
      if (Array.isArray(user.owned_orbits)) {
        // PocketBase stocke déjà comme un tableau
        ownedOrbits = user.owned_orbits
        console.log("📋 Orbites récupérées comme tableau:", ownedOrbits)
      } else if (typeof user.owned_orbits === "string" && user.owned_orbits) {
        // Stocké comme chaîne JSON
        ownedOrbits = JSON.parse(user.owned_orbits)
        console.log("📋 Orbites récupérées comme JSON:", ownedOrbits)
      } else {
        // Aucune orbite possédée
        ownedOrbits = []
        console.log("📋 Aucune orbite possédée")
      }
    } catch (e) {
      console.warn("⚠️ Erreur parsing owned_orbits, initialisation à []:", e.message)
      ownedOrbits = []
    }

    console.log("🛍️ Orbites possédées:", ownedOrbits)
    console.log("🎯 Orbite à équiper:", orbitType)

    // ✅ CORRECTION : Vérifier si l'utilisateur possède cette orbite
    if (orbitType !== "default" && !ownedOrbits.includes(orbitType)) {
      console.log("❌ Orbite non possédée")
      return new Response(
        JSON.stringify({
          success: false,
          message: "Vous ne possédez pas cette orbite !",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // ✅ CORRECTION : Équiper l'orbite
    const newEquippedOrbit = orbitType === "default" ? "" : orbitType

    await pb.collection("users").update(userId, {
      equipped_orbit: newEquippedOrbit,
    })

    console.log("✅ Orbite équipée:", newEquippedOrbit || "default")

    return new Response(
      JSON.stringify({
        success: true,
        message: orbitType === "default" ? "Orbite par défaut équipée" : `${getOrbitName(orbitType)} équipé !`,
        equippedOrbit: newEquippedOrbit,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("❌ Erreur lors de l'équipement:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur lors de l'équipement",
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
