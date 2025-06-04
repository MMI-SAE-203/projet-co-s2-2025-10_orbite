import PocketBase from "pocketbase"

export const prerender = false

export async function POST({ request }) {
  try {
    console.log("🎯 === ATTRIBUTION DES POINTS AUTOMATIQUE ===")

    const pb = new PocketBase("http://127.0.0.1:8090")
    const now = new Date()

    console.log("🕐 Heure actuelle:", now.toISOString())

    // 1. Récupérer TOUS les événements passés
    const allEvents = await pb.collection("event").getFullList()
    console.log(`📋 Total événements dans la base: ${allEvents.length}`)

    // 2. Filtrer les événements passés
    const pastEvents = allEvents.filter((event) => {
      const eventDate = new Date(event.date_event)
      return eventDate < now
    })

    console.log(`📅 Événements passés: ${pastEvents.length}`)

    let totalPointsAwarded = 0
    let participantsRewarded = 0
    const processedEvents = []

    // 3. Traiter chaque événement passé
    for (const event of pastEvents) {
      console.log(`\n🔍 Traitement: ${event.nom_event}`)
      console.log(`📅 Date: ${event.date_event}`)
      console.log(`👥 Participants: ${event.participe ? event.participe.length : 0}`)

      // Vérifier s'il y a des participants
      if (event.participe && Array.isArray(event.participe) && event.participe.length > 0) {
        // Attribuer 10 points à chaque participant
        for (const participantId of event.participe) {
          try {
            console.log(`⭐ Attribution points à: ${participantId}`)

            // Récupérer l'utilisateur
            const user = await pb.collection("users").getOne(participantId)
            const currentPoints = user.points || 0
            const newPoints = currentPoints + 10

            // Mettre à jour les points
            await pb.collection("users").update(participantId, {
              points: newPoints,
            })

            console.log(`✅ ${user.username || user.email}: ${currentPoints} → ${newPoints} points`)

            totalPointsAwarded += 10
            participantsRewarded++
          } catch (userError) {
            console.warn(`⚠️ Erreur utilisateur ${participantId}:`, userError.message)
          }
        }

        // Marquer l'événement comme traité
        try {
          await pb.collection("event").update(event.id, {
            points_distributed: true,
          })
          console.log(`✅ Événement marqué comme traité`)
        } catch (updateError) {
          console.warn(`⚠️ Erreur marquage événement:`, updateError.message)
        }

        processedEvents.push({
          id: event.id,
          name: event.nom_event,
          participants: event.participe.length,
          date: event.date_event,
        })
      }
    }

    const result = {
      success: true,
      message: "Attribution des points terminée",
      eventsProcessed: processedEvents.length,
      participantsRewarded,
      totalPointsAwarded,
      events: processedEvents,
    }

    console.log("📊 RÉSULTAT:")
    console.log(`✅ Événements traités: ${result.eventsProcessed}`)
    console.log(`👥 Participants récompensés: ${result.participantsRewarded}`)
    console.log(`⭐ Points attribués: ${result.totalPointsAwarded}`)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ ERREUR:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur lors de l'attribution des points",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

export async function GET() {
  return POST({ request: new Request("") })
}
