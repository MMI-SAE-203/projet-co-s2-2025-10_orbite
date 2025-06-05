import PocketBase from "pocketbase"

export const prerender = false

// Cette API sera appelée automatiquement pour vérifier les événements qui viennent de passer
export async function POST({ request }) {
  try {
    console.log("🔍 === DÉBUT VÉRIFICATION AUTO-CHECK-POINTS ===")
    console.log("🕐 Timestamp:", new Date().toISOString())

    // Initialiser PocketBase avec gestion d'erreur
    let pb
    try {
      pb = new PocketBase('https://pocketbaseprojet.alexandre-demling.fr')
      console.log("✅ PocketBase initialisé")
    } catch (pbError) {
      console.error("❌ Erreur initialisation PocketBase:", pbError)
      throw new Error(`Impossible d'initialiser PocketBase: ${pbError.message}`)
    }

    // Test de connexion à PocketBase
    try {
      const health = await pb.health.check()
      console.log("✅ PocketBase accessible:", health)
    } catch (healthError) {
      console.error("❌ PocketBase non accessible:", healthError)
      throw new Error(`PocketBase non accessible: ${healthError.message}`)
    }

    const now = new Date()
    console.log("🕐 Heure actuelle:", now.toISOString())

    // ✅ Récupérer TOUS les événements passés qui n'ont pas encore distribué les points
    let allPastEvents = []
    try {
      console.log("📋 Récupération des événements passés...")

      // Essayer d'abord sans filtre pour voir si la collection existe
      const testEvents = await pb.collection("event").getList(1, 1)
      console.log("✅ Collection 'event' accessible, total:", testEvents.totalItems)

      // Maintenant récupérer les événements passés
      allPastEvents = await pb.collection("event").getFullList({
        filter: `date_event < "${now.toISOString()}"`,
        sort: "-date_event",
      })

      console.log(`📊 Total événements passés: ${allPastEvents.length}`)

      // Filtrer ceux qui n'ont pas encore distribué les points
      const eventsWithoutPoints = allPastEvents.filter((event) => !event.points_distributed)
      console.log(`📊 Événements sans points distribués: ${eventsWithoutPoints.length}`)

      allPastEvents = eventsWithoutPoints
    } catch (eventsError) {
      console.error("❌ Erreur récupération événements:", eventsError)
      console.error("❌ Détails erreur:", eventsError.response?.data || eventsError.message)
      throw new Error(`Erreur récupération événements: ${eventsError.message}`)
    }

    console.log(`📋 ${allPastEvents.length} événements passés trouvés sans points distribués`)

    let totalPointsAwarded = 0
    let participantsRewarded = 0
    const eventsProcessed = []

    // Traiter chaque événement
    for (let i = 0; i < allPastEvents.length; i++) {
      const event = allPastEvents[i]
      console.log(`\n🔄 [${i + 1}/${allPastEvents.length}] Traitement événement: ${event.nom_event}`)
      console.log(`📅 Date événement: ${event.date_event}`)
      console.log(`👥 Participants: ${event.participe ? event.participe.length : 0}`)
      console.log(`🎯 Points déjà distribués: ${event.points_distributed || false}`)

      try {
        if (event.participe && Array.isArray(event.participe) && event.participe.length > 0) {
          console.log(`⭐ Attribution des points pour l'événement: ${event.nom_event}`)

          // Attribuer 10 points à chaque participant
          for (let j = 0; j < event.participe.length; j++) {
            const participantId = event.participe[j]
            console.log(`🔄 [${j + 1}/${event.participe.length}] Attribution points à: ${participantId}`)

            try {
              // Récupérer l'utilisateur
              const participant = await pb.collection("users").getOne(participantId)
              console.log(`👤 Participant trouvé: ${participant.username || participant.email || participant.name}`)

              const currentPoints = participant.points || 0
              const newPoints = currentPoints + 10

              // Mettre à jour les points
              await pb.collection("users").update(participantId, {
                points: newPoints,
              })

              totalPointsAwarded += 10
              participantsRewarded++

              console.log(`✅ Points attribués: ${currentPoints} -> ${newPoints}`)
            } catch (userError) {
              console.warn(`⚠️ Erreur attribution points utilisateur ${participantId}:`, userError.message)
              // Continuer avec les autres participants
            }
          }

          // Marquer l'événement comme ayant distribué les points
          try {
            await pb.collection("event").update(event.id, {
              points_distributed: true,
            })
            console.log(`✅ Événement ${event.nom_event} marqué comme points distribués`)
          } catch (updateError) {
            console.error(`❌ Erreur marquage événement ${event.id}:`, updateError.message)
            // Continuer quand même
          }

          eventsProcessed.push({
            id: event.id,
            name: event.nom_event,
            participants: event.participe.length,
            date: event.date_event,
          })
        } else {
          console.log(`ℹ️ Aucun participant pour l'événement: ${event.nom_event}`)

          // Marquer quand même l'événement pour éviter de le retraiter
          try {
            await pb.collection("event").update(event.id, {
              points_distributed: true,
            })
            console.log(`✅ Événement sans participants marqué: ${event.nom_event}`)
          } catch (updateError) {
            console.error(`❌ Erreur marquage événement vide ${event.id}:`, updateError.message)
          }
        }
      } catch (eventError) {
        console.error(`❌ Erreur traitement événement ${event.id}:`, eventError.message)
        // Continuer avec les autres événements
      }
    }

    const result = {
      success: true,
      message: "Vérification automatique terminée",
      eventsProcessed: eventsProcessed.length,
      participantsRewarded,
      totalPointsAwarded,
      events: eventsProcessed,
      timestamp: now.toISOString(),
    }

    console.log("📊 === RÉSULTAT FINAL ===")
    console.log("✅ Succès:", result.success)
    console.log("📈 Événements traités:", result.eventsProcessed)
    console.log("👥 Participants récompensés:", result.participantsRewarded)
    console.log("⭐ Total points attribués:", result.totalPointsAwarded)
    console.log("🔍 === FIN VÉRIFICATION AUTO-CHECK-POINTS ===")

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("❌ === ERREUR GLOBALE AUTO-CHECK-POINTS ===")
    console.error("❌ Message:", error.message)
    console.error("❌ Stack:", error.stack)
    console.error("❌ Erreur complète:", error)

    const errorResult = {
      success: false,
      message: "Erreur lors de la vérification automatique",
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function GET({ request }) {
  console.log("📡 GET request reçu, redirection vers POST")
  return POST({ request })
}
