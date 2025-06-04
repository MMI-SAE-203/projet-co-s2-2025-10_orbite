// API endpoint for handling comments
export const prerender = false

import PocketBase from "pocketbase"

// Initialiser PocketBase
const pb = new PocketBase("http://127.0.0.1:8090")

// Stockage temporaire en mémoire pour les commentaires
const tempComments = new Map()

export async function GET({ url }) {
  const eventId = url.searchParams.get("eventId")

  if (!eventId) {
    return new Response(JSON.stringify({ error: "Event ID is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  try {
    console.log("📥 GET - Récupération des commentaires pour l'événement:", eventId)

    // Récupérer les commentaires existants de PocketBase
    const existingComments = []
    try {
      // ✅ Récupérer d'abord les commentaires sans expand
      const rawComments = await pb.collection("comments").getFullList({
        filter: `event = "${eventId}"`,
        sort: "-created",
      })

      console.log("📋 Commentaires bruts récupérés:", rawComments.length)

      // ✅ Pour chaque commentaire, récupérer manuellement les données utilisateur
      for (const comment of rawComments) {
        try {
          console.log("🔍 Récupération utilisateur pour commentaire:", comment.id, "user ID:", comment.users)

          const user = await pb.collection("users").getOne(comment.users)

          // ✅ Construire le commentaire avec les données utilisateur
          const enrichedComment = {
            ...comment,
            expand: {
              users: user,
            },
          }

          existingComments.push(enrichedComment)

          console.log("✅ Commentaire enrichi:", {
            id: comment.id,
            content: comment.content.substring(0, 30) + "...",
            user: {
              id: user.id,
              name: user.name,
              username: user.username,
              email: user.email,
              avatar: user.avatar,
            },
          })
        } catch (userError) {
          console.warn("⚠️ Impossible de récupérer l'utilisateur pour le commentaire:", comment.id, userError)
          // Ajouter le commentaire sans données utilisateur
          existingComments.push({
            ...comment,
            expand: {
              users: {
                id: comment.users,
                name: "Utilisateur inconnu",
                username: "unknown",
                email: "unknown@example.com",
                avatar: null,
              },
            },
          })
        }
      }

      console.log("✅ Commentaires PocketBase enrichis:", existingComments.length)
    } catch (pbError) {
      console.warn("⚠️ Erreur PocketBase, utilisation du stockage temporaire:", pbError)
    }

    // Récupérer les commentaires temporaires pour cet événement
    const tempEventComments = tempComments.get(eventId) || []
    console.log("📋 Commentaires temporaires:", tempEventComments.length)

    // Combiner les deux sources de commentaires
    const allComments = [...existingComments, ...tempEventComments]

    // Trier par date (plus récents en premier)
    allComments.sort((a, b) => {
      const dateA = new Date(a.created || a.date)
      const dateB = new Date(b.created || b.date)
      return dateB - dateA
    })

    console.log("✅ Total commentaires retournés:", allComments.length)

    return new Response(JSON.stringify(allComments), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des commentaires:", error)

    return new Response(JSON.stringify({ error: "Failed to retrieve comments" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function POST({ request }) {
  try {
    console.log("📥 POST - Création d'un nouveau commentaire")

    const formData = await request.formData()
    const eventId = formData.get("eventId")
    const username = formData.get("username") || "Utilisateur"
    const comment = formData.get("comment")
    const userToken = formData.get("userToken")

    console.log("📋 Données reçues:", {
      eventId,
      username,
      comment: comment ? comment.substring(0, 50) + "..." : "vide",
      hasToken: !!userToken,
    })

    if (!eventId || !comment) {
      console.error("❌ Données manquantes")
      return new Response(JSON.stringify({ error: "EventId and comment are required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    // Essayer d'abord de sauvegarder dans PocketBase
    let savedToPocketBase = false
    let newComment = null

    if (userToken) {
      try {
        console.log("🔐 Tentative d'authentification avec PocketBase...")
        pb.authStore.save(userToken, null)
        await pb.collection("users").authRefresh()

        console.log("✅ Authentification réussie, sauvegarde dans PocketBase...")
        console.log("👤 Utilisateur authentifié:", pb.authStore.model)

        const commentData = {
          event: eventId,
          users: pb.authStore.model.id,
          content: comment.trim(),
        }

        // ✅ Créer le commentaire d'abord
        const createdComment = await pb.collection("comments").create(commentData)

        // ✅ Puis récupérer manuellement les données utilisateur
        const user = await pb.collection("users").getOne(pb.authStore.model.id)

        // ✅ Construire le commentaire complet avec les données utilisateur
        newComment = {
          ...createdComment,
          expand: {
            users: user,
          },
        }

        savedToPocketBase = true
        console.log("✅ Commentaire sauvegardé dans PocketBase:", newComment.id)
        console.log("📋 Données utilisateur récupérées:", {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
        })
      } catch (pbError) {
        console.warn("⚠️ Erreur PocketBase, utilisation du stockage temporaire:", pbError)
      }
    }

    // Si PocketBase a échoué, utiliser le stockage temporaire
    if (!savedToPocketBase) {
      console.log("📝 Sauvegarde en stockage temporaire...")

      newComment = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        event: eventId,
        content: comment.trim(),
        created: new Date().toISOString(),
        expand: {
          users: {
            id: "temp_user",
            name: username,
            username: username,
            email: `${username}@temp.com`,
            avatar: null,
          },
        },
        // Format compatible avec l'affichage
        users: "temp_user",
      }

      // Ajouter au stockage temporaire
      if (!tempComments.has(eventId)) {
        tempComments.set(eventId, [])
      }

      tempComments.get(eventId).push(newComment)
      console.log("✅ Commentaire ajouté au stockage temporaire")
    }

    console.log(`✅ Commentaire créé sur ${eventId} par ${username}`)

    // Retourner une réponse JSON au lieu d'une redirection
    return new Response(
      JSON.stringify({
        success: true,
        comment: newComment,
        message: "Commentaire ajouté avec succès",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("❌ Erreur lors de la création du commentaire:", error)

    return new Response(JSON.stringify({ error: "Failed to process comment" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function DELETE({ url }) {
  try {
    console.log("📥 DELETE - Suppression d'un commentaire")

    const commentId = url.searchParams.get("id")
    const userToken = url.searchParams.get("token")

    console.log("📋 Paramètres:", { commentId, hasToken: !!userToken })

    if (!commentId) {
      return new Response(JSON.stringify({ error: "Comment ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    // Essayer de supprimer de PocketBase d'abord
    let deletedFromPocketBase = false

    if (userToken && !commentId.startsWith("temp_")) {
      try {
        console.log("🔐 Tentative d'authentification pour suppression...")
        pb.authStore.save(userToken, null)
        await pb.collection("users").authRefresh()

        // Vérifier que l'utilisateur est l'auteur
        const comment = await pb.collection("comments").getOne(commentId)
        if (comment.users === pb.authStore.model.id) {
          await pb.collection("comments").delete(commentId)
          deletedFromPocketBase = true
          console.log("✅ Commentaire supprimé de PocketBase")
        } else {
          throw new Error("Vous ne pouvez supprimer que vos propres commentaires")
        }
      } catch (pbError) {
        console.warn("⚠️ Erreur lors de la suppression PocketBase:", pbError)
        return new Response(JSON.stringify({ error: pbError.message }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
    }

    // Si c'est un commentaire temporaire ou si PocketBase a échoué
    if (!deletedFromPocketBase && commentId.startsWith("temp_")) {
      console.log("🗑️ Suppression du stockage temporaire...")

      // Parcourir tous les événements pour trouver et supprimer le commentaire
      for (const [eventId, comments] of tempComments.entries()) {
        const index = comments.findIndex((c) => c.id === commentId)
        if (index !== -1) {
          comments.splice(index, 1)
          console.log("✅ Commentaire temporaire supprimé")
          break
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Commentaire supprimé avec succès",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("❌ Erreur lors de la suppression:", error)

    return new Response(JSON.stringify({ error: "Failed to delete comment" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}
