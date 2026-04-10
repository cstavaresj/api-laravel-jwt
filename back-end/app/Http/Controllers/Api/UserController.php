<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{


    /**
     * Update the authenticated user's profile.
     * The user can only update their OWN data (ownership enforced).
     *
     * PATCH /api/user/profile
     */
    public function profile(UpdateProfileRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();

        // Only update fields that were actually sent in the request
        $validatedData = $request->validated();

        if (empty($validatedData)) {
            return response()->json([
                'success' => false,
                'message' => 'Nenhum dado foi enviado para atualização.',
            ], 422);
        }

        $user->update($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Perfil atualizado com sucesso!',
            'user' => $user->fresh(),
        ]);
    }
}
