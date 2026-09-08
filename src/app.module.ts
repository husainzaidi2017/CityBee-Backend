import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { CitiesModule } from './cities/cities.module';
import { LocationModule } from './location/location.module';
import { BusinessesModule } from './businesses/businesses.module';
import { OffersModule } from './offers/offers.module';
import { DoctorsModule } from './doctors/doctors.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { HotelsModule } from './hotels/hotels.module';
import { PlacesModule } from './places/places.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CitiesModule,
    LocationModule,
    BusinessesModule,
    OffersModule,
    DoctorsModule,
    RestaurantsModule,
    HotelsModule,
    PlacesModule,
    FavoritesModule,
    ReviewsModule,
    NotificationsModule,
    UploadsModule,
  ],
})
export class AppModule {}
