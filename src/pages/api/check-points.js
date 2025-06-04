import PocketBase from "pocketbase"

export const prerender = false

export async function POST({ request }) {
  try {
    console.log("🔍 Vérification des points de participation...")

    const pb = new PocketBase("http://127.0.0.1:8090")
    const now = new Date()

    // Récupérer tous les événements passés qui n'ont pas encore distribué les points
    const pastEvents = await pb.collection("event").getFullList({
      filter: `date_event < "${now.toISOString()}" && points_distributed != true`,
    })

    console.log(`📋 ${pastEvents.length} événements passés trouvés`)

    let totalPointsAwarded = 0
    let participantsRewarded = 0

    for (const event of pastEvents) {
      if (event.participe && event.participe.length > 0) {
        console.log(`⭐ Attribution des points pour l'événement: ${event.nom_event}`)

        // Attribuer 10 points à chaque participant
        for (const participantId of event.participe) {
          try {
            const participant = await pb.collection("users").getOne(participantId)
            const currentPoints = participant.points || 0
            const newPoints = currentPoints + 10

            await pb.collection("users").update(participantId, {
              points: newPoints,
            })

            totalPointsAwarded += 10
            participantsRewarded++

            console.log(
              `✅ Points attribués à ${participant.username || participant.email}: ${currentPoints} -> ${newPoints}`,
            )
          } catch (userError) {
            console.warn(`⚠️ Impossible d'attribuer les points à l'utilisateur ${participantId}:`, userError)
          }
        }

        // Marquer l'événement comme ayant distribué les points
        await pb.collection("event").update(event.id, {
          points_distributed: true,
        })

        console.log(`✅ Événement ${event.nom_event} marqué comme points distribués`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vérification des points terminée",
        eventsProcessed: pastEvents.length,
        participantsRewarded,
        totalPointsAwarded,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("❌ Erreur lors de la vérification des points:", error)

    return new Response(
      JSON.stringify({
        success: false,
        message: "Erreur lors de la vérification des points",
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function GET({ request }) {
  // Permettre aussi les requêtes GET pour faciliter les tests
  return POST({ request })
}
