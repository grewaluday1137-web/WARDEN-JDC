package com.jdcoders.crisisconnect.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.jdcoders.crisisconnect.screens.auth.PermissionScreen
import com.jdcoders.crisisconnect.screens.auth.OTPLoginScreen
import com.jdcoders.crisisconnect.screens.home.HomeScreen
import com.jdcoders.crisisconnect.screens.map.RoomDetailsScreen
import com.jdcoders.crisisconnect.screens.splash.SplashScreen
import com.jdcoders.crisisconnect.screens.updates.UpdatesScreen
import com.jdcoders.crisisconnect.screens.intel.WardenIntelScreen
import com.jdcoders.crisisconnect.screens.settings.NotificationsSettingsScreen
import com.jdcoders.crisisconnect.screens.settings.LanguageSettingsScreen
import com.jdcoders.crisisconnect.screens.contacts.EmergencyContactsScreen
import com.jdcoders.crisisconnect.screens.settings.LocationSharingScreen

@Composable
fun NavGraph(navController: NavHostController) {
    // Shared Auth ViewModel
    val authViewModel: com.jdcoders.crisisconnect.screens.auth.AuthViewModel = androidx.lifecycle.viewmodel.compose.viewModel()

    NavHost(
        navController = navController,
        startDestination = Routes.SPLASH
    ) {

        composable(Routes.SPLASH) {
            SplashScreen(navController)
        }

        composable("permissions") {
            PermissionScreen(navController)
        }

        composable(Routes.OTP_LOGIN) {
            OTPLoginScreen(navController, authViewModel)
        }

        composable(Routes.HOME) {
            HomeScreen(navController)
        }

        composable(Routes.UPDATES) {
            UpdatesScreen(navController)
        }

        composable(Routes.WARDEN_INTEL) {
            WardenIntelScreen(navController)
        }

        composable(Routes.NOTIFICATIONS_SETTINGS) {
            NotificationsSettingsScreen(navController)
        }

        composable(Routes.LANGUAGE_SETTINGS) {
            LanguageSettingsScreen(navController)
        }

        composable(Routes.EMERGENCY_CONTACTS) {
            EmergencyContactsScreen(navController)
        }

        composable(Routes.LOCATION_SHARING) {
            LocationSharingScreen(navController)
        }

        composable("roomDetails") {
            RoomDetailsScreen()
        }
    }
}