import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HomePageComponent } from './components/homepage/homepage.component';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';
import { SettingsMenuComponent } from './components/settings-menu/settings-menu.component';


@NgModule({
  declarations: [
    HeaderComponent,
    FooterComponent,
    HomePageComponent,
    ThemeToggleComponent,
    SettingsMenuComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    FormsModule,
  ],
  exports:[
    HeaderComponent,
    FooterComponent,
    HomePageComponent,
    ThemeToggleComponent,
    SettingsMenuComponent
  ]
})
export class SharedModule { }
